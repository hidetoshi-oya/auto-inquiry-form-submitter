"""
フォーム検出・送信関連のCeleryタスク
"""
import asyncio
from typing import Dict, Any, List
import logging
from datetime import datetime, timezone

from celery import Task
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.database import get_db
from app.models.company import Company
from app.models.form import Form
from app.models.submission import Submission
from app.models.template import Template
from app.services.form_detector import form_detector
from app.services.form_submitter import form_submitter
from app.services.browser_pool import browser_pool
from app.schemas.submission import SubmissionStatus

logger = logging.getLogger(__name__)


def record_task_to_redis(task_id: str, task_name: str, status: str):
    """タスク履歴をRedisに記録"""
    try:
        import redis
        r = redis.Redis(host='redis', port=6379, db=1, decode_responses=True)
        
        # タスク履歴リストに追加（最新100件まで保持）
        r.lpush('celery:task_history', task_id)
        r.ltrim('celery:task_history', 0, 99)
        
        # タスク詳細情報を保存
        task_data = {
            'task_id': task_id,
            'task_name': task_name,
            'status': status,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        r.hset(f'celery:task:{task_id}', mapping=task_data)
        r.expire(f'celery:task:{task_id}', 86400)  # 24時間で期限切れ
        
    except Exception as e:
        logger.warning(f"Redisタスク履歴記録エラー: {e}")


# AsyncTaskクラスは削除（直接イベントループで非同期処理を実行）


@celery_app.task(bind=True, name="app.tasks.form_tasks.detect_forms_task")
def detect_forms_task(self, company_id: int, force_refresh: bool = False) -> Dict[str, Any]:
    """フォーム検出のCeleryタスク"""
    logger.info(f"フォーム検出タスク開始: company_id={company_id}")
    
    async def async_detect_forms():
        """非同期でフォーム検出を実行"""
        # データベースセッションを取得
        db: Session = next(get_db())
        
        try:
            # 企業情報を取得
            company = db.query(Company).filter(Company.id == company_id).first()
            if not company:
                raise ValueError(f"Company not found: {company_id}")
            
            # 既存フォームの確認
            if not force_refresh:
                existing_forms = db.query(Form).filter(Form.company_id == company_id).all()
                if existing_forms:
                    logger.info(f"既存フォームが見つかりました: {len(existing_forms)}個")
                    return {
                        "success": True,
                        "message": "Forms already exist",
                        "company_id": company_id,
                        "forms_count": len(existing_forms),
                        "forms": [{"id": f.id, "url": f.form_url} for f in existing_forms]
                    }
            
            # タスク開始状態を更新
            self.update_state(
                state='PROGRESS',
                meta={
                    'current': 0,
                    'total': 1,
                    'status': 'フォーム検出開始',
                    'company_id': company_id,
                    'company_url': company.url
                }
            )
            record_task_to_redis(self.request.id, 'detect_forms_task', 'STARTED')
            
            # フォーム検出を実行
            detected_forms = await form_detector.detect_forms(company.url, company_id, db)
            
            logger.info(f"フォーム検出完了: {len(detected_forms)}個のフォームが検出されました")
            
            # タスク状態をRedisに記録
            try:
                self.update_state(
                    state='SUCCESS',
                    meta={
                        'current': len(detected_forms),
                        'total': len(detected_forms),
                        'status': 'フォーム検出完了',
                        'company_id': company_id,
                        'company_url': company.url,
                        'forms_count': len(detected_forms)
                    }
                )
                record_task_to_redis(self.request.id, 'detect_forms_task', 'SUCCESS')
            except Exception as e:
                logger.warning(f"タスク状態更新エラー: {e}")
            
            return {
                "success": True,
                "message": "Form detection completed",
                "company_id": company_id,
                "company_url": company.url,
                "forms_count": len(detected_forms),
                "detected_forms": detected_forms
            }
            
        finally:
            db.close()
    
    # 非同期関数を実行
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(async_detect_forms())
        finally:
            loop.close()
    except Exception as e:
        logger.error(f"フォーム検出タスクエラー: {e}")
        
        # エラー状態を更新
        try:
            self.update_state(
                state='FAILURE',
                meta={
                    'error': str(e),
                    'company_id': company_id,
                    'retries': self.request.retries
                }
            )
            record_task_to_redis(self.request.id, 'detect_forms_task', 'FAILURE')
        except Exception as update_error:
            logger.warning(f"タスクエラー状態更新失敗: {update_error}")
        
        # リトライロジック
        if self.request.retries < self.max_retries:
            logger.info(f"リトライします: {self.request.retries + 1}/{self.max_retries}")
            raise self.retry(countdown=60, exc=e)
        
        return {
            "success": False,
            "error": str(e),
            "company_id": company_id,
            "retries": self.request.retries
        }


@celery_app.task(bind=True, name="app.tasks.form_tasks.submit_form_task")
def submit_form_task(
    self,
    form_id: int,
    template_id: int,
    template_data: Dict[str, Any],
    take_screenshot: bool = True,
    dry_run: bool = False
) -> Dict[str, Any]:
    """フォーム送信のCeleryタスク"""
    logger.info(f"フォーム送信タスク開始: form_id={form_id}, template_id={template_id}")
    
    async def async_submit_form():
        """非同期でフォーム送信を実行"""
        try:
            # データベースセッションを取得
            db: Session = next(get_db())
            
            try:
                # フォーム送信を実行
                result = await form_submitter.submit_form(
                    form_id=form_id,
                    template_id=template_id,
                    template_data=template_data,
                    db=db,
                    take_screenshot=take_screenshot,
                    dry_run=dry_run
                )
                
                logger.info(f"フォーム送信完了: submission_id={result.get('submission_id')}, status={result.get('status')}")
                
                return {
                    "success": True,
                    "message": "Form submission completed",
                    "result": result
                }
                
            finally:
                db.close()
        
        except Exception as e:
            logger.error(f"フォーム送信タスクエラー: {e}")
            
            # CAPTCHA必須の場合はリトライしない
            if "CAPTCHA" in str(e) or "captcha" in str(e):
                return {
                    "success": False,
                    "error": "CAPTCHA required - manual intervention needed",
                    "form_id": form_id,
                    "requires_manual_action": True
                }
            
            # その他のエラーはリトライ
            if self.request.retries < self.max_retries:
                logger.info(f"リトライします: {self.request.retries + 1}/{self.max_retries}")
                raise self.retry(countdown=120, exc=e)  # 2分後にリトライ
            
            return {
                "success": False,
                "error": str(e),
                "form_id": form_id,
                "retries": self.request.retries
            }
    
    # 非同期関数を実行
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(async_submit_form())
        finally:
            loop.close()
    except Exception as e:
        logger.error(f"フォーム送信タスク実行エラー: {e}")
        return {
            "success": False,
            "error": str(e),
            "form_id": form_id
        }


@celery_app.task(name="app.tasks.form_tasks.browser_pool_maintenance")
def browser_pool_maintenance() -> Dict[str, Any]:
    """ブラウザプールのメンテナンスタスク"""
    logger.info("ブラウザプールメンテナンス開始")
    
    async def async_maintenance():
        """非同期でブラウザプールメンテナンスを実行"""
        try:
            # ブラウザプールが初期化されていない場合は初期化
            if not browser_pool._initialized:
                logger.info("ブラウザプールが初期化されていないため、初期化を開始します")
                await browser_pool.initialize()
            
            # 古いブラウザインスタンスをクリーンアップ
            await browser_pool.cleanup_old_browsers(max_age_minutes=30)
            
            # 統計情報を取得
            stats = browser_pool.get_stats()
            
            logger.info(f"ブラウザプールメンテナンス完了: {stats}")
            
            return {
                "success": True,
                "message": "Browser pool maintenance completed",
                "stats": stats
            }
            
        except Exception as e:
            logger.error(f"ブラウザプールメンテナンスエラー: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    # 非同期関数を実行
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(async_maintenance())
        finally:
            loop.close()
    except Exception as e:
        logger.error(f"ブラウザプールメンテナンス実行エラー: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@celery_app.task(name="app.tasks.form_tasks.cleanup_failed_submissions")
def cleanup_failed_submissions(days_old: int = 7) -> Dict[str, Any]:
    """失敗した送信記録のクリーンアップタスク"""
    logger.info(f"失敗した送信記録のクリーンアップ開始: {days_old}日以前")
    
    try:
        db: Session = next(get_db())
        
        try:
            from datetime import timedelta
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)
            
            # 失敗した送信記録を削除
            deleted_count = (
                db.query(Submission)
                .filter(
                    Submission.status == SubmissionStatus.FAILED,
                    Submission.submitted_at < cutoff_date
                )
                .delete()
            )
            
            db.commit()
            
            logger.info(f"クリーンアップ完了: {deleted_count}件の失敗記録を削除")
            
            return {
                "success": True,
                "message": "Cleanup completed",
                "deleted_count": deleted_count,
                "cutoff_date": cutoff_date.isoformat()
            }
            
        finally:
            db.close()
    
    except Exception as e:
        logger.error(f"クリーンアップエラー: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@celery_app.task(bind=True, name="app.tasks.form_tasks.test_form_submission")
def test_form_submission(self, company_id: int, template_id: int) -> Dict[str, Any]:
    """フォーム送信のテストタスク（ドライラン）"""
    logger.info(f"フォーム送信テスト開始: company_id={company_id}, template_id={template_id}")
    
    async def async_test_submission():
        """非同期でテスト送信を実行"""
        try:
            db: Session = next(get_db())
            
            try:
                # 企業のフォームを取得
                forms = db.query(Form).filter(Form.company_id == company_id).all()
                if not forms:
                    return {
                        "success": False,
                        "error": "No forms found for this company"
                    }
                
                # テンプレートを取得
                template = db.query(Template).filter(Template.id == template_id).first()
                if not template:
                    return {
                        "success": False,
                        "error": "Template not found"
                    }
                
                # 会社情報を取得
                company = db.query(Company).filter(Company.id == company_id).first()
                
                # テストデータを構築
                test_data = {
                    "company_name": company.name,
                    "contact_name": "テスト 太郎",
                    "email": "test@example.com",
                    "phone": "03-1234-5678",
                    "message": "これはテスト送信です。実際には送信されません。"
                }
                
                # 最初のフォームでテスト送信（ドライラン）
                form = forms[0]
                result = await form_submitter.submit_form(
                    form_id=form.id,
                    template_id=template_id,
                    template_data=test_data,
                    db=db,
                    take_screenshot=True,
                    dry_run=True  # ドライランで実行
                )
                
                logger.info(f"フォーム送信テスト完了: {result}")
                
                return {
                    "success": True,
                    "message": "Test submission completed (dry run)",
                    "test_result": result,
                    "test_data": test_data
                }
                
            finally:
                db.close()
        
        except Exception as e:
            logger.error(f"フォーム送信テストエラー: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    # 非同期関数を実行
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(async_test_submission())
        finally:
            loop.close()
    except Exception as e:
        logger.error(f"テスト送信タスク実行エラー: {e}")
        return {
            "success": False,
            "error": str(e)
        } 