"""
バッチ送信関連のCeleryタスク
"""
import asyncio
from typing import Dict, Any, List
import logging
from datetime import datetime, timezone

from celery import Task, group, chain
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.database import get_db
from app.models.company import Company
from app.models.form import Form
from app.models.template import Template
from app.models.submission import Submission
from app.schemas.submission import SubmissionStatus
from app.tasks.form_tasks import submit_form_task

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="app.tasks.batch_tasks.batch_submission")
def batch_submission(
    self,
    company_ids: List[int],
    template_id: int,
    interval_seconds: int = 30,
    dry_run: bool = False,
    take_screenshot: bool = True
) -> Dict[str, Any]:
    """バッチ送信メインタスク"""
    logger.info(f"バッチ送信開始: {len(company_ids)}社, template_id={template_id}")
    
    try:
        db: Session = next(get_db())
        
        try:
            # テンプレートの妥当性確認
            template = db.query(Template).filter(Template.id == template_id).first()
            if not template:
                raise ValueError(f"Template not found: {template_id}")
            
            # 企業の妥当性確認
            companies = db.query(Company).filter(Company.id.in_(company_ids)).all()
            found_company_ids = {c.id for c in companies}
            missing_ids = set(company_ids) - found_company_ids
            
            if missing_ids:
                logger.warning(f"見つからない企業ID: {missing_ids}")
            
            valid_company_ids = list(found_company_ids)
            
            if not valid_company_ids:
                raise ValueError("No valid companies found")
            
            # バッチ送信実行タスクをスケジュール
            batch_execution_task.apply_async(
                args=[valid_company_ids, template_id, interval_seconds, dry_run, take_screenshot],
                countdown=5  # 5秒後に開始
            )
            
            logger.info(f"バッチ送信タスクをスケジュール: {len(valid_company_ids)}社")
            
            return {
                "success": True,
                "message": "Batch submission scheduled",
                "total_companies": len(company_ids),
                "valid_companies": len(valid_company_ids),
                "invalid_companies": len(missing_ids),
                "invalid_company_ids": list(missing_ids),
                "template_id": template_id,
                "interval_seconds": interval_seconds,
                "dry_run": dry_run
            }
            
        finally:
            db.close()
    
    except Exception as e:
        logger.error(f"バッチ送信エラー: {e}")
        return {
            "success": False,
            "error": str(e),
            "company_ids": company_ids,
            "template_id": template_id
        }


@celery_app.task(bind=True, name="app.tasks.batch_tasks.batch_execution_task")
def batch_execution_task(
    self,
    company_ids: List[int],
    template_id: int,
    interval_seconds: int,
    dry_run: bool,
    take_screenshot: bool
) -> Dict[str, Any]:
    """バッチ送信実行タスク"""
    logger.info(f"バッチ送信実行開始: {len(company_ids)}社")
    
    try:
        db: Session = next(get_db())
        
        try:
            # テンプレートの妥当性確認
            template = db.query(Template).filter(Template.id == template_id).first()
            if not template:
                raise ValueError(f"Template not found: {template_id}")
            
            # 進捗状態を更新
            self.update_state(
                state='PROGRESS',
                meta={
                    'current': 0,
                    'total': len(company_ids),
                    'status': 'バッチ送信実行中',
                    'template_id': template_id
                }
            )
            
            processed_count = 0
            successful_submissions = 0
            failed_submissions = 0
            captcha_required = 0
            results = []
            
            # 各企業に対してフォーム送信を実行
            for i, company_id in enumerate(company_ids):
                try:
                    # 企業情報を取得
                    company = db.query(Company).filter(Company.id == company_id).first()
                    if not company:
                        logger.warning(f"Company not found: {company_id}")
                        failed_submissions += 1
                        results.append({
                            "company_id": company_id,
                            "status": "failed",
                            "error": "Company not found"
                        })
                        continue
                    
                    # 企業のフォームを取得
                    forms = db.query(Form).filter(Form.company_id == company_id).all()
                    if not forms:
                        logger.warning(f"No forms found for company: {company_id}")
                        failed_submissions += 1
                        results.append({
                            "company_id": company_id,
                            "status": "failed",
                            "error": "No forms found"
                        })
                        continue
                    
                    # テンプレートデータを構築
                    template_data = {
                        "company_name": company.name,
                        "contact_name": template.sender_name or "お問い合わせ担当",
                        "email": template.sender_email or "inquiry@example.com",
                        "phone": template.sender_phone or "",
                        "message": template.message_template or "お問い合わせ内容"
                    }
                    
                    # 最初のフォームに送信（複数フォームがある場合は最初のものを使用）
                    form = forms[0]
                    
                    # submit_form_task を同期的に実行
                    from app.tasks.form_tasks import submit_form_task
                    result = submit_form_task(
                        form_id=form.id,
                        template_id=template_id,
                        template_data=template_data,
                        take_screenshot=take_screenshot,
                        dry_run=dry_run
                    )
                    
                    # 結果を分析
                    if result.get("success", False):
                        successful_submissions += 1
                        results.append({
                            "company_id": company_id,
                            "company_name": company.name,
                            "status": "success",
                            "result": result
                        })
                    elif result.get("requires_manual_action", False):
                        captcha_required += 1
                        results.append({
                            "company_id": company_id,
                            "company_name": company.name,
                            "status": "captcha_required",
                            "error": result.get("error", "CAPTCHA required")
                        })
                    else:
                        failed_submissions += 1
                        results.append({
                            "company_id": company_id,
                            "company_name": company.name,
                            "status": "failed",
                            "error": result.get("error", "Unknown error")
                        })
                    
                    processed_count += 1
                    
                    # 進捗更新
                    self.update_state(
                        state='PROGRESS',
                        meta={
                            'current': processed_count,
                            'total': len(company_ids),
                            'status': f'{processed_count}/{len(company_ids)}社処理完了',
                            'successful': successful_submissions,
                            'failed': failed_submissions,
                            'captcha': captcha_required
                        }
                    )
                    
                    # インターバル（最後の処理でない場合のみ）
                    if i < len(company_ids) - 1 and interval_seconds > 0:
                        import time
                        time.sleep(interval_seconds)
                        
                except Exception as e:
                    logger.error(f"Company {company_id} processing error: {e}")
                    failed_submissions += 1
                    processed_count += 1
                    results.append({
                        "company_id": company_id,
                        "status": "failed",
                        "error": str(e)
                    })
            
            # 成功率を計算
            success_rate = (successful_submissions / processed_count * 100) if processed_count > 0 else 0
            
            # 最終結果
            final_result = {
                "success": True,
                "message": "Batch execution completed",
                "company_ids": company_ids,
                "template_id": template_id,
                "processed_count": processed_count,
                "successful_submissions": successful_submissions,
                "failed_submissions": failed_submissions,
                "captcha_required": captcha_required,
                "success_rate": round(success_rate, 2),
                "results": results,
                "dry_run": dry_run
            }
            
            logger.info(f"バッチ送信完了: {processed_count}社処理, 成功: {successful_submissions}, 失敗: {failed_submissions}, CAPTCHA: {captcha_required}")
            
            return final_result
            
        finally:
            db.close()
    
    except Exception as e:
        logger.error(f"バッチ送信実行エラー: {e}")
        
        # エラー状態を更新
        self.update_state(
            state='FAILURE',
            meta={
                'error': str(e),
                'company_ids': company_ids,
                'template_id': template_id
            }
        )
        
        return {
            "success": False,
            "error": str(e),
            "company_ids": company_ids,
            "template_id": template_id,
            "processed_count": 0,
            "successful_submissions": 0,
            "failed_submissions": 0,
            "captcha_required": 0
        }


# build_template_data と send_batch_completion_report は一時的に無効化
# 非同期処理の修正が必要


def generate_batch_report(summary: Dict[str, Any]) -> Dict[str, Any]:
    """バッチ送信レポートを生成"""
    
    total = summary.get("total_companies", 0)
    successful = summary.get("successful_submissions", 0)
    failed = summary.get("failed_submissions", 0)
    captcha = summary.get("captcha_required", 0)
    success_rate = summary.get("success_rate", 0)
    
    report = {
        "title": "バッチ送信完了レポート",
        "execution_time": summary.get("execution_time"),
        "summary": {
            "total_companies": total,
            "successful_submissions": successful,
            "failed_submissions": failed,
            "captcha_required": captcha,
            "success_rate": f"{success_rate:.1f}%"
        },
        "details": summary.get("results", []),
        "recommendations": []
    }
    
    # 推奨事項を追加
    if captcha > 0:
        report["recommendations"].append(
            f"{captcha}社でCAPTCHA認証が必要です。手動で送信を完了してください。"
        )
    
    if failed > 0:
        report["recommendations"].append(
            f"{failed}社で送信に失敗しました。エラー内容を確認して再試行してください。"
        )
    
    if success_rate < 50:
        report["recommendations"].append(
            "成功率が低いです。フォーム検出やテンプレート設定を見直してください。"
        )
    
    return report


@celery_app.task(name="app.tasks.batch_tasks.retry_failed_submissions")
def retry_failed_submissions(batch_id: str = None, max_age_hours: int = 24) -> Dict[str, Any]:
    """失敗した送信のリトライタスク"""
    logger.info(f"失敗送信のリトライ開始: batch_id={batch_id}")
    
    try:
        db: Session = next(get_db())
        
        try:
            from datetime import timedelta
            
            # リトライ対象の送信を取得
            query = db.query(Submission).filter(
                Submission.status == SubmissionStatus.FAILED,
                Submission.submitted_at >= datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
            )
            
            if batch_id:
                # 特定のバッチIDがある場合（将来の実装）
                pass
            
            failed_submissions = query.all()
            
            if not failed_submissions:
                return {
                    "success": True,
                    "message": "No failed submissions to retry",
                    "retry_count": 0
                }
            
            retry_count = 0
            retry_results = []
            
            for submission in failed_submissions:
                try:
                    # リトライ実行
                    submit_form_task.apply_async(
                        args=[
                            submission.form_id,
                            submission.template_id,
                            submission.submitted_data,
                            True,  # take_screenshot
                            False  # dry_run
                        ],
                        countdown=30  # 30秒後に実行
                    )
                    
                    retry_count += 1
                    retry_results.append({
                        "submission_id": submission.id,
                        "company_id": submission.company_id,
                        "status": "scheduled_for_retry"
                    })
                    
                except Exception as e:
                    logger.error(f"送信 {submission.id} のリトライスケジュールに失敗: {e}")
                    retry_results.append({
                        "submission_id": submission.id,
                        "company_id": submission.company_id,
                        "status": "retry_failed",
                        "error": str(e)
                    })
            
            logger.info(f"リトライ完了: {retry_count}件をスケジュール")
            
            return {
                "success": True,
                "message": "Retry tasks scheduled",
                "retry_count": retry_count,
                "total_failed": len(failed_submissions),
                "retry_results": retry_results
            }
            
        finally:
            db.close()
    
    except Exception as e:
        logger.error(f"リトライタスクエラー: {e}")
        return {
            "success": False,
            "error": str(e)
        } 