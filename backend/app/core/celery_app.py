"""
Celeryアプリケーションの設定とタスク定義
"""
import redis
import logging
from celery import Celery
from celery.schedules import crontab
from celery.signals import task_prerun, task_postrun, task_success, task_failure
from app.core.config import settings

logger = logging.getLogger(__name__)

# Celeryアプリケーションの作成
celery_app = Celery(
    "auto_inquiry_form_submitter",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.form_tasks",
        "app.tasks.batch_tasks",
        "app.tasks.schedule_tasks"
    ]
)

# Celery設定
celery_app.conf.update(
    # タスク設定
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Tokyo",
    enable_utc=True,
    
    # ワーカー設定
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    worker_disable_rate_limits=True,
    
    # リトライ設定
    task_default_retry_delay=60,  # 60秒
    task_max_retries=3,
    
    # 結果の保存期間
    result_expires=3600,  # 1時間
    
    # タスク追跡設定
    task_track_started=True,  # タスク開始を追跡
    task_store_errors_even_if_ignored=True,  # エラーも保存
    
    # バッチ処理設定
    task_always_eager=False,  # 開発時はTrueにしてテスト可能
    
    # ルーティング設定
    task_routes={
        "app.tasks.form_tasks.*": {"queue": "forms"},
        "app.tasks.batch_tasks.*": {"queue": "batch"},
        "app.tasks.schedule_tasks.*": {"queue": "schedule"},
    },
    
    # デフォルトキュー設定
    task_default_queue="default",
    task_default_exchange="default",
    task_default_routing_key="default",
)

# Celery Beat（スケジューラー）設定
celery_app.conf.beat_schedule = {
    # スケジュール実行のチェック（毎分）
    "check-scheduled-submissions": {
        "task": "app.tasks.schedule_tasks.check_scheduled_submissions",
        "schedule": crontab(minute="*"),  # 毎分実行
    },
    
    # システムヘルスチェック（5分おき）
    "system-health-check": {
        "task": "app.tasks.schedule_tasks.system_health_check",
        "schedule": crontab(minute="*/5"),  # 5分おき
    },
    
    # 古いログのクリーンアップ（毎日午前2時）
    "cleanup-old-logs": {
        "task": "app.tasks.schedule_tasks.cleanup_old_logs",
        "schedule": crontab(hour=2, minute=0),  # 毎日 02:00
    },
    
    # ブラウザプールのメンテナンス（30分おき）
    "browser-pool-maintenance": {
        "task": "app.tasks.form_tasks.browser_pool_maintenance",
        "schedule": crontab(minute="*/30"),  # 30分おき
    },
}


# Redis接続の取得
def get_redis_connection():
    """Redis接続を取得"""
    try:
        return redis.Redis(host='redis', port=6379, db=1, decode_responses=True)
    except Exception as e:
        logger.error(f"Redis接続エラー: {e}")
        return None


# タスク開始時のシグナルハンドラー
@task_prerun.connect
def task_prerun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, **kwds):
    """タスク開始時にRedisに記録"""
    try:
        r = get_redis_connection()
        if r:
            # タスク履歴リストの先頭にタスクIDを追加
            r.lpush('celery:task_history', task_id)
            # リストの長さを制限（最新200件のみ保持）
            r.ltrim('celery:task_history', 0, 199)
            
            # タスクの実行時刻を記録
            import time
            r.hset(f'celery:task:{task_id}', 'started_at', str(time.time()))
            r.hset(f'celery:task:{task_id}', 'task_name', task.name if task else 'unknown')
            
            logger.debug(f"タスク開始記録: {task_id}")
    except Exception as e:
        logger.error(f"タスク開始記録エラー {task_id}: {e}")


# タスク完了時のシグナルハンドラー
@task_postrun.connect
def task_postrun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, retval=None, state=None, **kwds):
    """タスク完了時にRedisに記録"""
    try:
        r = get_redis_connection()
        if r:
            # タスクの完了時刻と状態を記録
            import time
            r.hset(f'celery:task:{task_id}', 'completed_at', str(time.time()))
            r.hset(f'celery:task:{task_id}', 'state', state or 'UNKNOWN')
            
            # タスク詳細の有効期限を設定（24時間）
            r.expire(f'celery:task:{task_id}', 86400)
            
            logger.debug(f"タスク完了記録: {task_id}, 状態: {state}")
    except Exception as e:
        logger.error(f"タスク完了記録エラー {task_id}: {e}")


# タスク成功時のシグナルハンドラー
@task_success.connect
def task_success_handler(sender=None, result=None, **kwds):
    """タスク成功時の処理"""
    try:
        task_id = kwds.get('task_id')
        if task_id:
            r = get_redis_connection()
            if r:
                r.hset(f'celery:task:{task_id}', 'result', 'SUCCESS')
                logger.debug(f"タスク成功記録: {task_id}")
    except Exception as e:
        logger.error(f"タスク成功記録エラー: {e}")


# タスク失敗時のシグナルハンドラー
@task_failure.connect
def task_failure_handler(sender=None, task_id=None, exception=None, traceback=None, einfo=None, **kwds):
    """タスク失敗時の処理"""
    try:
        r = get_redis_connection()
        if r:
            r.hset(f'celery:task:{task_id}', 'result', 'FAILURE')
            r.hset(f'celery:task:{task_id}', 'error', str(exception) if exception else 'Unknown error')
            logger.debug(f"タスク失敗記録: {task_id}, エラー: {exception}")
    except Exception as e:
        logger.error(f"タスク失敗記録エラー {task_id}: {e}") 