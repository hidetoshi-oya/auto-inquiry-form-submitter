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
from app.tasks.form_tasks import submit_form_task, AsyncTask

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


@celery_app.task(base=AsyncTask, bind=True, name="app.tasks.batch_tasks.batch_execution_task")
async def batch_execution_task(
    self,
    company_ids: List[int],
    template_id: int,
    interval_seconds: int,
    dry_run: bool,
    take_screenshot: bool
) -> Dict[str, Any]:
    """バッチ送信実行タスク"""
    logger.info(f"バッチ送信実行開始: {len(company_ids)}社")
    
    batch_results = []
    successful_submissions = 0
    failed_submissions = 0
    captcha_required = 0
    
    try:
        db: Session = next(get_db())
        
        try:
            # テンプレート情報を取得
            template = db.query(Template).filter(Template.id == template_id).first()
            
            for i, company_id in enumerate(company_ids):
                try:
                    logger.info(f"送信実行 {i+1}/{len(company_ids)}: company_id={company_id}")
                    
                    # 企業とフォーム情報を取得
                    company = db.query(Company).filter(Company.id == company_id).first()
                    if not company:
                        logger.warning(f"企業が見つかりません: {company_id}")
                        continue
                    
                    forms = db.query(Form).filter(Form.company_id == company_id).all()
                    if not forms:
                        logger.warning(f"フォームが見つかりません: company_id={company_id}")
                        batch_results.append({
                            "company_id": company_id,
                            "company_name": company.name,
                            "success": False,
                            "error": "No forms found"
                        })
                        failed_submissions += 1
                        continue
                    
                    # テンプレートデータを構築
                    template_data = await build_template_data(company, template)
                    
                    # 最初のフォームで送信実行
                    form = forms[0]
                    
                    result = await submit_form_task.apply_async(
                        args=[form.id, template_id, template_data, take_screenshot, dry_run]
                    ).get()
                    
                    # 結果を記録
                    if result.get("success"):
                        successful_submissions += 1
                        status = "success"
                        if result.get("result", {}).get("status") == "captcha_required":
                            captcha_required += 1
                            status = "captcha_required"
                    else:
                        failed_submissions += 1
                        status = "failed"
                        if result.get("requires_manual_action"):
                            captcha_required += 1
                            status = "captcha_required"
                    
                    batch_results.append({
                        "company_id": company_id,
                        "company_name": company.name,
                        "form_id": form.id,
                        "success": result.get("success", False),
                        "status": status,
                        "submission_id": result.get("result", {}).get("submission_id"),
                        "error": result.get("error"),
                        "processed_at": datetime.now(timezone.utc).isoformat()
                    })
                    
                    # 次の送信まで間隔を空ける（最後でない場合）
                    if i < len(company_ids) - 1:
                        logger.info(f"送信間隔待機: {interval_seconds}秒")
                        await asyncio.sleep(interval_seconds)
                    
                except Exception as e:
                    logger.error(f"企業 {company_id} の送信処理でエラー: {e}")
                    batch_results.append({
                        "company_id": company_id,
                        "success": False,
                        "error": str(e),
                        "processed_at": datetime.now(timezone.utc).isoformat()
                    })
                    failed_submissions += 1
                    continue
            
            # バッチ送信サマリーを生成
            summary = {
                "success": True,
                "message": "Batch execution completed",
                "total_companies": len(company_ids),
                "successful_submissions": successful_submissions,
                "failed_submissions": failed_submissions,
                "captcha_required": captcha_required,
                "success_rate": (successful_submissions / len(company_ids)) * 100 if company_ids else 0,
                "execution_time": datetime.now(timezone.utc).isoformat(),
                "results": batch_results
            }
            
            logger.info(f"バッチ送信完了: 成功={successful_submissions}, 失敗={failed_submissions}, CAPTCHA={captcha_required}")
            
            # サマリーレポートを送信
            await send_batch_completion_report.apply_async(args=[summary])
            
            return summary
            
        finally:
            db.close()
    
    except Exception as e:
        logger.error(f"バッチ送信実行エラー: {e}")
        return {
            "success": False,
            "error": str(e),
            "partial_results": batch_results,
            "processed_companies": len(batch_results)
        }


async def build_template_data(company: Company, template: Template) -> Dict[str, Any]:
    """テンプレートデータを構築"""
    
    # 基本的なテンプレートデータ
    template_data = {
        "company_name": company.name,
        "company_url": company.url,
        "contact_name": "営業担当",  # デフォルト値
        "email": "info@yourcompany.com",  # 設定から取得予定
        "phone": "03-1234-5678",  # 設定から取得予定
        "current_date": datetime.now().strftime("%Y年%m月%d日"),
        "current_year": datetime.now().year
    }
    
    # テンプレートフィールドがある場合は追加
    if hasattr(template, 'fields') and template.fields:
        for field in template.fields:
            if hasattr(field, 'default_value') and field.default_value:
                template_data[field.name] = field.default_value
    
    # 基本的なメッセージを設定
    if "message" not in template_data:
        template_data["message"] = (
            f"いつもお世話になっております。\n\n"
            f"弊社サービスについてご案内させていただきたく、"
            f"ご連絡させていただきました。\n\n"
            f"お忙しい中恐縮ですが、ご検討のほどよろしくお願いいたします。"
        )
    
    return template_data


@celery_app.task(base=AsyncTask, name="app.tasks.batch_tasks.send_batch_completion_report")
async def send_batch_completion_report(summary: Dict[str, Any]) -> Dict[str, Any]:
    """バッチ送信完了レポートの送信"""
    logger.info("バッチ送信完了レポート生成開始")
    
    try:
        # レポート内容を生成
        report = generate_batch_report(summary)
        
        # TODO: メール送信機能を実装
        # await send_email_report(report)
        
        # TODO: Slack通知機能を実装
        # await send_slack_notification(report)
        
        logger.info("バッチ送信完了レポート生成完了")
        
        return {
            "success": True,
            "message": "Report generated successfully",
            "report": report
        }
        
    except Exception as e:
        logger.error(f"レポート生成エラー: {e}")
        return {
            "success": False,
            "error": str(e)
        }


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