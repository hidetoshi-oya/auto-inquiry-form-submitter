"""
スケジュール管理とシステムメンテナンス関連のCeleryタスク
"""
import asyncio
from typing import Dict, Any, List
import logging
from datetime import datetime, timezone, timedelta
from croniter import croniter

from celery import Task
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.database import get_db
from app.models.schedule import Schedule
from app.models.submission import Submission
from app.models.company import Company
from app.models.template import Template
from app.schemas.submission import SubmissionStatus
from app.tasks.batch_tasks import batch_submission
from app.tasks.form_tasks import AsyncTask

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.schedule_tasks.check_scheduled_submissions")
def check_scheduled_submissions() -> Dict[str, Any]:
    """スケジュールされた送信をチェックして実行"""
    logger.info("スケジュール送信チェック開始")
    
    try:
        db: Session = next(get_db())
        
        try:
            current_time = datetime.now(timezone.utc)
            
            # 実行可能なスケジュールを取得
            schedules = (
                db.query(Schedule)
                .filter(
                    Schedule.enabled == True,
                    Schedule.next_run_at <= current_time
                )
                .all()
            )
            
            executed_schedules = []
            
            for schedule in schedules:
                try:
                    logger.info(f"スケジュール実行: {schedule.name} (ID: {schedule.id})")
                    
                    # バッチ送信を実行
                    batch_submission.apply_async(
                        args=[
                            schedule.company_ids,
                            schedule.template_id,
                            30,  # interval_seconds
                            False,  # dry_run
                            True  # take_screenshot
                        ]
                    )
                    
                    # 次回実行時刻を計算
                    next_run = calculate_next_run_time(schedule.cron_expression, current_time)
                    
                    # スケジュール情報を更新
                    schedule.last_run_at = current_time
                    schedule.next_run_at = next_run
                    
                    executed_schedules.append({
                        "schedule_id": schedule.id,
                        "schedule_name": schedule.name,
                        "companies_count": len(schedule.company_ids),
                        "template_id": schedule.template_id,
                        "last_run_at": current_time.isoformat(),
                        "next_run_at": next_run.isoformat()
                    })
                    
                except Exception as e:
                    logger.error(f"スケジュール {schedule.id} の実行エラー: {e}")
                    executed_schedules.append({
                        "schedule_id": schedule.id,
                        "schedule_name": schedule.name,
                        "error": str(e),
                        "status": "failed"
                    })
            
            db.commit()
            
            logger.info(f"スケジュールチェック完了: {len(executed_schedules)}件実行")
            
            return {
                "success": True,
                "message": "Schedule check completed",
                "executed_schedules": executed_schedules,
                "total_executed": len(executed_schedules),
                "check_time": current_time.isoformat()
            }
            
        finally:
            db.close()
    
    except Exception as e:
        logger.error(f"スケジュールチェックエラー: {e}")
        return {
            "success": False,
            "error": str(e)
        }


def calculate_next_run_time(cron_expression: str, current_time: datetime) -> datetime:
    """cron式から次回実行時刻を計算"""
    try:
        cron = croniter(cron_expression, current_time)
        next_run = cron.get_next(datetime)
        return next_run.replace(tzinfo=timezone.utc)
    except Exception as e:
        logger.error(f"cron式の解析エラー: {cron_expression}, {e}")
        # エラーの場合は1時間後に設定
        return current_time + timedelta(hours=1)


@celery_app.task(name="app.tasks.schedule_tasks.system_health_check")
def system_health_check() -> Dict[str, Any]:
    """システムヘルスチェック"""
    logger.info("システムヘルスチェック開始")
    
    try:
        db: Session = next(get_db())
        
        try:
            current_time = datetime.now(timezone.utc)
            
            # データベース接続チェック
            db_status = check_database_health(db)
            
            # 送信統計をチェック
            submission_stats = check_submission_health(db, current_time)
            
            # ブラウザプール状態をチェック
            browser_stats = check_browser_pool_health()
            
            # 全体的な健康状態を判定
            overall_health = "healthy"
            issues = []
            
            if not db_status["healthy"]:
                overall_health = "degraded"
                issues.append("Database connection issues")
            
            if submission_stats["recent_failures_rate"] > 50:
                overall_health = "degraded"
                issues.append("High failure rate in recent submissions")
            
            if not browser_stats["healthy"]:
                overall_health = "degraded"
                issues.append("Browser pool issues")
            
            health_report = {
                "overall_health": overall_health,
                "check_time": current_time.isoformat(),
                "database": db_status,
                "submissions": submission_stats,
                "browser_pool": browser_stats,
                "issues": issues
            }
            
            logger.info(f"ヘルスチェック完了: {overall_health}")
            
            # 問題がある場合はアラートを送信
            if overall_health != "healthy":
                send_health_alert(health_report)
            
            return {
                "success": True,
                "health_report": health_report
            }
            
        finally:
            db.close()
    
    except Exception as e:
        logger.error(f"ヘルスチェックエラー: {e}")
        return {
            "success": False,
            "error": str(e),
            "overall_health": "unhealthy"
        }


def check_database_health(db: Session) -> Dict[str, Any]:
    """データベースの健康状態をチェック"""
    try:
        # 簡単なクエリでDB接続を確認
        count = db.query(Company).count()
        
        return {
            "healthy": True,
            "companies_count": count,
            "connection_status": "connected"
        }
    except Exception as e:
        logger.error(f"データベースヘルスチェックエラー: {e}")
        return {
            "healthy": False,
            "error": str(e),
            "connection_status": "failed"
        }


def check_submission_health(db: Session, current_time: datetime) -> Dict[str, Any]:
    """送信統計の健康状態をチェック"""
    try:
        # 過去1時間の送信統計
        one_hour_ago = current_time - timedelta(hours=1)
        
        recent_submissions = (
            db.query(Submission)
            .filter(Submission.submitted_at >= one_hour_ago)
            .all()
        )
        
        total_recent = len(recent_submissions)
        
        if total_recent == 0:
            return {
                "healthy": True,
                "recent_submissions": 0,
                "recent_failures": 0,
                "recent_failures_rate": 0,
                "note": "No recent submissions"
            }
        
        recent_failures = sum(
            1 for s in recent_submissions 
            if s.status == SubmissionStatus.FAILED
        )
        
        failure_rate = (recent_failures / total_recent) * 100
        
        return {
            "healthy": failure_rate < 50,
            "recent_submissions": total_recent,
            "recent_failures": recent_failures,
            "recent_failures_rate": failure_rate
        }
        
    except Exception as e:
        logger.error(f"送信統計ヘルスチェックエラー: {e}")
        return {
            "healthy": False,
            "error": str(e)
        }


def check_browser_pool_health() -> Dict[str, Any]:
    """ブラウザプールの健康状態をチェック"""
    try:
        from app.services.browser_pool import browser_pool
        
        stats = browser_pool.get_stats()
        
        if stats["status"] == "not_initialized":
            return {
                "healthy": False,
                "status": "not_initialized",
                "note": "Browser pool not initialized"
            }
        
        # アクティブなブラウザの数をチェック
        healthy = stats["active_browsers"] > 0
        
        return {
            "healthy": healthy,
            "status": stats["status"],
            "active_browsers": stats["active_browsers"],
            "total_usage": stats["total_usage"]
        }
        
    except Exception as e:
        logger.error(f"ブラウザプールヘルスチェックエラー: {e}")
        return {
            "healthy": False,
            "error": str(e)
        }


def send_health_alert(health_report: Dict[str, Any]):
    """ヘルスアラートを送信"""
    try:
        logger.warning(f"システムヘルスアラート: {health_report['overall_health']}")
        
        # TODO: メール・Slack通知の実装
        # await send_email_alert(health_report)
        # await send_slack_alert(health_report)
        
    except Exception as e:
        logger.error(f"ヘルスアラート送信エラー: {e}")


@celery_app.task(name="app.tasks.schedule_tasks.cleanup_old_logs")
def cleanup_old_logs(days_old: int = 30) -> Dict[str, Any]:
    """古いログとデータのクリーンアップ"""
    logger.info(f"古いデータのクリーンアップ開始: {days_old}日以前")
    
    try:
        db: Session = next(get_db())
        
        try:
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)
            
            # 古い成功した送信記録を削除
            deleted_submissions = (
                db.query(Submission)
                .filter(
                    Submission.status == SubmissionStatus.SUCCESS,
                    Submission.submitted_at < cutoff_date
                )
                .delete()
            )
            
            # 古いスクリーンショットファイルのクリーンアップ
            # TODO: 実際のファイル削除処理を実装
            
            db.commit()
            
            cleanup_summary = {
                "success": True,
                "message": "Cleanup completed",
                "cutoff_date": cutoff_date.isoformat(),
                "deleted_submissions": deleted_submissions,
                "cleanup_time": datetime.now(timezone.utc).isoformat()
            }
            
            logger.info(f"クリーンアップ完了: 送信記録 {deleted_submissions}件削除")
            
            return cleanup_summary
            
        finally:
            db.close()
    
    except Exception as e:
        logger.error(f"クリーンアップエラー: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@celery_app.task(name="app.tasks.schedule_tasks.generate_daily_report")
def generate_daily_report() -> Dict[str, Any]:
    """日次レポートの生成"""
    logger.info("日次レポート生成開始")
    
    try:
        db: Session = next(get_db())
        
        try:
            current_time = datetime.now(timezone.utc)
            yesterday = current_time - timedelta(days=1)
            
            # 昨日の送信統計を収集
            daily_submissions = (
                db.query(Submission)
                .filter(
                    Submission.submitted_at >= yesterday,
                    Submission.submitted_at < current_time
                )
                .all()
            )
            
            # 統計計算
            total_submissions = len(daily_submissions)
            successful = sum(1 for s in daily_submissions if s.status == SubmissionStatus.SUCCESS)
            failed = sum(1 for s in daily_submissions if s.status == SubmissionStatus.FAILED)
            captcha_required = sum(1 for s in daily_submissions if s.status == SubmissionStatus.CAPTCHA_REQUIRED)
            
            success_rate = (successful / total_submissions * 100) if total_submissions > 0 else 0
            
            # 企業別統計
            company_stats = {}
            for submission in daily_submissions:
                company_id = submission.company_id
                if company_id not in company_stats:
                    company_stats[company_id] = {
                        "total": 0,
                        "successful": 0,
                        "failed": 0
                    }
                
                company_stats[company_id]["total"] += 1
                if submission.status == SubmissionStatus.SUCCESS:
                    company_stats[company_id]["successful"] += 1
                elif submission.status == SubmissionStatus.FAILED:
                    company_stats[company_id]["failed"] += 1
            
            daily_report = {
                "report_date": yesterday.strftime("%Y-%m-%d"),
                "generation_time": current_time.isoformat(),
                "summary": {
                    "total_submissions": total_submissions,
                    "successful_submissions": successful,
                    "failed_submissions": failed,
                    "captcha_required": captcha_required,
                    "success_rate": round(success_rate, 2)
                },
                "company_stats": company_stats,
                "total_companies_processed": len(company_stats)
            }
            
            logger.info(f"日次レポート生成完了: {total_submissions}件の送信")
            
            # レポートを保存またはメール送信
            # TODO: レポート保存・送信機能の実装
            
            return {
                "success": True,
                "daily_report": daily_report
            }
            
        finally:
            db.close()
    
    except Exception as e:
        logger.error(f"日次レポート生成エラー: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@celery_app.task(base=AsyncTask, name="app.tasks.schedule_tasks.create_schedule")
async def create_schedule(
    name: str,
    company_ids: List[int],
    template_id: int,
    cron_expression: str,
    enabled: bool = True
) -> Dict[str, Any]:
    """新しいスケジュールを作成"""
    logger.info(f"スケジュール作成: {name}")
    
    try:
        db: Session = next(get_db())
        
        try:
            # cron式の妥当性をチェック
            try:
                current_time = datetime.now(timezone.utc)
                next_run = calculate_next_run_time(cron_expression, current_time)
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Invalid cron expression: {cron_expression}",
                    "details": str(e)
                }
            
            # 企業とテンプレートの存在確認
            companies = db.query(Company).filter(Company.id.in_(company_ids)).all()
            template = db.query(Template).filter(Template.id == template_id).first()
            
            if len(companies) != len(company_ids):
                missing_ids = set(company_ids) - {c.id for c in companies}
                return {
                    "success": False,
                    "error": f"Companies not found: {missing_ids}"
                }
            
            if not template:
                return {
                    "success": False,
                    "error": f"Template not found: {template_id}"
                }
            
            # スケジュールを作成
            schedule = Schedule(
                name=name,
                company_ids=company_ids,
                template_id=template_id,
                cron_expression=cron_expression,
                enabled=enabled,
                next_run_at=next_run
            )
            
            db.add(schedule)
            db.commit()
            db.refresh(schedule)
            
            logger.info(f"スケジュール作成完了: ID={schedule.id}")
            
            return {
                "success": True,
                "message": "Schedule created successfully",
                "schedule": {
                    "id": schedule.id,
                    "name": schedule.name,
                    "company_count": len(company_ids),
                    "template_id": template_id,
                    "cron_expression": cron_expression,
                    "enabled": enabled,
                    "next_run_at": next_run.isoformat()
                }
            }
            
        finally:
            db.close()
    
    except Exception as e:
        logger.error(f"スケジュール作成エラー: {e}")
        return {
            "success": False,
            "error": str(e)
        } 