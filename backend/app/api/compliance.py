from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict, Any
import logging

from app.core.compliance import (
    get_compliance_manager, 
    ComplianceCheck, 
    ComplianceLevel,
    check_url_compliance
)
from app.api.deps import get_current_active_user
from app.schemas.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


class ComplianceCheckRequest(BaseModel):
    """コンプライアンスチェックリクエスト"""
    url: HttpUrl
    compliance_level: Optional[str] = "moderate"


class ComplianceCheckResponse(BaseModel):
    """コンプライアンスチェックレスポンス"""
    url: str
    allowed: bool
    warnings: List[str]
    errors: List[str]
    recommendations: List[str]
    delay_seconds: float
    compliance_level: str


class SitePolicyResponse(BaseModel):
    """サイトポリシーレスポンス"""
    url: str
    robots_txt_url: str
    terms_of_service_url: Optional[str]
    allows_crawling: bool
    requires_delay: float
    detected_restrictions: List[str]


class ComplianceStatsResponse(BaseModel):
    """コンプライアンス統計レスポンス"""
    total_checks: int
    allowed_count: int
    blocked_count: int
    warning_count: int
    domains_with_restrictions: List[str]
    average_delay: float


@router.post("/check", response_model=ComplianceCheckResponse)
async def check_compliance(
    request: ComplianceCheckRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    指定されたURLのコンプライアンスをチェック
    """
    try:
        compliance_manager = get_compliance_manager()
        
        # コンプライアンスレベルを設定
        if request.compliance_level:
            try:
                level = ComplianceLevel(request.compliance_level.lower())
                compliance_manager.compliance_level = level
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"無効なコンプライアンスレベル: {request.compliance_level}"
                )
        
        # コンプライアンスチェック実行
        check_result = await compliance_manager.check_compliance(str(request.url))
        
        return ComplianceCheckResponse(
            url=str(request.url),
            allowed=check_result.allowed,
            warnings=check_result.warnings,
            errors=check_result.errors,
            recommendations=check_result.recommendations,
            delay_seconds=check_result.delay_seconds,
            compliance_level=compliance_manager.compliance_level.value
        )
        
    except Exception as e:
        logger.error(f"コンプライアンスチェックエラー: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"コンプライアンスチェックに失敗しました: {str(e)}"
        )


@router.get("/site-policy/{domain:path}", response_model=SitePolicyResponse)
async def get_site_policy(
    domain: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    指定されたドメインのサイトポリシーを取得
    """
    try:
        # URLの正規化
        if not domain.startswith(('http://', 'https://')):
            domain = f"https://{domain}"
        
        compliance_manager = get_compliance_manager()
        policy = compliance_manager.get_site_policy(domain)
        
        # 制限の検出
        detected_restrictions = []
        if not policy.allows_crawling:
            detected_restrictions.append("robots.txt制限")
        if policy.requires_delay > 2:
            detected_restrictions.append(f"高遅延要求({policy.requires_delay}秒)")
        if policy.terms_of_service_url:
            detected_restrictions.append("利用規約検出")
        
        return SitePolicyResponse(
            url=domain,
            robots_txt_url=policy.robots_txt_url,
            terms_of_service_url=policy.terms_of_service_url,
            allows_crawling=policy.allows_crawling,
            requires_delay=policy.requires_delay,
            detected_restrictions=detected_restrictions
        )
        
    except Exception as e:
        logger.error(f"サイトポリシー取得エラー: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"サイトポリシーの取得に失敗しました: {str(e)}"
        )


@router.post("/batch-check")
async def batch_check_compliance(
    urls: List[HttpUrl],
    compliance_level: str = "moderate",
    current_user: User = Depends(get_current_active_user)
):
    """
    複数URLのコンプライアンスを一括チェック
    """
    if len(urls) > 50:  # 制限
        raise HTTPException(
            status_code=400,
            detail="一度にチェックできるURLは50個までです"
        )
    
    try:
        compliance_manager = get_compliance_manager()
        
        # コンプライアンスレベル設定
        try:
            level = ComplianceLevel(compliance_level.lower())
            compliance_manager.compliance_level = level
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"無効なコンプライアンスレベル: {compliance_level}"
            )
        
        results = []
        for url in urls:
            try:
                check_result = await compliance_manager.check_compliance(str(url))
                results.append({
                    "url": str(url),
                    "allowed": check_result.allowed,
                    "warnings": check_result.warnings,
                    "errors": check_result.errors,
                    "recommendations": check_result.recommendations,
                    "delay_seconds": check_result.delay_seconds
                })
            except Exception as e:
                results.append({
                    "url": str(url),
                    "allowed": False,
                    "warnings": [],
                    "errors": [f"チェック失敗: {str(e)}"],
                    "recommendations": [],
                    "delay_seconds": 0
                })
        
        return {"results": results}
        
    except Exception as e:
        logger.error(f"バッチコンプライアンスチェックエラー: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"バッチチェックに失敗しました: {str(e)}"
        )


@router.get("/stats", response_model=ComplianceStatsResponse)
async def get_compliance_stats(
    current_user: User = Depends(get_current_active_user)
):
    """
    コンプライアンス統計を取得
    """
    try:
        compliance_manager = get_compliance_manager()
        
        # 統計情報を計算
        total_checks = len(compliance_manager.site_policies)
        domains_with_restrictions = []
        total_delay = 0
        
        for domain, policy in compliance_manager.site_policies.items():
            if not policy.allows_crawling or policy.requires_delay > 2 or policy.terms_of_service_url:
                domains_with_restrictions.append(domain)
            total_delay += policy.requires_delay
        
        average_delay = total_delay / max(total_checks, 1)
        
        return ComplianceStatsResponse(
            total_checks=total_checks,
            allowed_count=total_checks - len(domains_with_restrictions),
            blocked_count=len(domains_with_restrictions),
            warning_count=len(domains_with_restrictions),  # 簡易計算
            domains_with_restrictions=[d.replace('https://', '').replace('http://', '') for d in domains_with_restrictions],
            average_delay=round(average_delay, 2)
        )
        
    except Exception as e:
        logger.error(f"コンプライアンス統計取得エラー: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"統計の取得に失敗しました: {str(e)}"
        )


@router.post("/record-result")
async def record_request_result(
    url: HttpUrl,
    success: bool,
    current_user: User = Depends(get_current_active_user)
):
    """
    リクエスト結果を記録（バックオフ戦略用）
    """
    try:
        compliance_manager = get_compliance_manager()
        compliance_manager.record_request_result(str(url), success)
        
        return {
            "message": "リクエスト結果を記録しました",
            "url": str(url),
            "success": success
        }
        
    except Exception as e:
        logger.error(f"結果記録エラー: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"結果の記録に失敗しました: {str(e)}"
        )


@router.get("/recommended-headers/{domain:path}")
async def get_recommended_headers(
    domain: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    指定ドメインの推奨HTTPヘッダーを取得
    """
    try:
        if not domain.startswith(('http://', 'https://')):
            domain = f"https://{domain}"
        
        compliance_manager = get_compliance_manager()
        headers = compliance_manager.get_recommended_headers(domain)
        
        return {
            "url": domain,
            "recommended_headers": headers
        }
        
    except Exception as e:
        logger.error(f"推奨ヘッダー取得エラー: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"推奨ヘッダーの取得に失敗しました: {str(e)}"
        ) 