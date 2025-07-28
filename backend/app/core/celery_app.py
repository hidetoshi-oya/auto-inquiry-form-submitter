"""
Celeryアプリケーションの設定とタスク定義
"""
from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

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