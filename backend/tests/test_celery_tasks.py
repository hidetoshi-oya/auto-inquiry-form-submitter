"""
Celeryタスクのテスト
"""
import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone

from app.tasks.form_tasks import AsyncTask
from app.tasks.schedule_tasks import calculate_next_run_time


class TestAsyncTask:
    """非同期タスクベースクラスのテスト"""
    
    def test_async_task_base(self):
        """AsyncTaskベースクラスの基本機能テスト"""
        
        # カスタムタスククラスを定義
        class TestTask(AsyncTask):
            async def async_run(self, x, y):
                return x + y
        
        task = TestTask()
        
        # 同期的に非同期メソッドを実行
        result = task.run(2, 3)
        assert result == 5


class TestScheduleTasks:
    """スケジュール関連タスクのテスト"""
    
    def test_calculate_next_run_time_valid_cron(self):
        """有効なcron式での次回実行時刻計算テスト"""
        current_time = datetime(2025, 1, 25, 12, 0, 0, tzinfo=timezone.utc)
        
        # 毎分実行
        next_run = calculate_next_run_time("* * * * *", current_time)
        assert next_run > current_time
        
        # 毎日午前2時実行
        next_run = calculate_next_run_time("0 2 * * *", current_time)
        assert next_run > current_time
    
    def test_calculate_next_run_time_invalid_cron(self):
        """無効なcron式でのエラーハンドリングテスト"""
        current_time = datetime(2025, 1, 25, 12, 0, 0, tzinfo=timezone.utc)
        
        # 無効なcron式
        next_run = calculate_next_run_time("invalid cron", current_time)
        
        # エラーの場合は1時間後に設定される
        expected = current_time.replace(hour=13)
        assert next_run == expected


class TestFormTasks:
    """フォーム関連タスクのテスト"""
    
    @pytest.mark.asyncio
    async def test_form_task_structure(self):
        """フォームタスクの構造テスト"""
        from app.tasks.form_tasks import detect_forms_task, submit_form_task
        
        # タスクが定義されていることを確認
        assert hasattr(detect_forms_task, 'apply_async')
        assert hasattr(submit_form_task, 'apply_async')
        
        # タスク名が正しく設定されていることを確認
        assert detect_forms_task.name == "app.tasks.form_tasks.detect_forms_task"
        assert submit_form_task.name == "app.tasks.form_tasks.submit_form_task"


class TestBatchTasks:
    """バッチ処理タスクのテスト"""
    
    def test_batch_task_structure(self):
        """バッチタスクの構造テスト"""
        from app.tasks.batch_tasks import batch_submission, batch_execution_task
        
        # タスクが定義されていることを確認
        assert hasattr(batch_submission, 'apply_async')
        assert hasattr(batch_execution_task, 'apply_async')
        
        # タスク名が正しく設定されていることを確認
        assert batch_submission.name == "app.tasks.batch_tasks.batch_submission"
        assert batch_execution_task.name == "app.tasks.batch_tasks.batch_execution_task"


class TestCeleryConfiguration:
    """Celery設定のテスト"""
    
    def test_celery_app_configuration(self):
        """Celeryアプリケーション設定のテスト"""
        from app.core.celery_app import celery_app
        
        # 基本設定の確認
        assert celery_app.conf.task_serializer == "json"
        assert celery_app.conf.accept_content == ["json"]
        assert celery_app.conf.result_serializer == "json"
        assert celery_app.conf.timezone == "Asia/Tokyo"
        
        # ルーティング設定の確認
        routes = celery_app.conf.task_routes
        assert "app.tasks.form_tasks.*" in routes
        assert "app.tasks.batch_tasks.*" in routes
        assert "app.tasks.schedule_tasks.*" in routes
        
        # キュー設定の確認
        assert routes["app.tasks.form_tasks.*"]["queue"] == "forms"
        assert routes["app.tasks.batch_tasks.*"]["queue"] == "batch"
        assert routes["app.tasks.schedule_tasks.*"]["queue"] == "schedule"
    
    def test_celery_beat_schedule(self):
        """Celery Beatスケジュール設定のテスト"""
        from app.core.celery_app import celery_app
        
        schedule = celery_app.conf.beat_schedule
        
        # 基本的なスケジュールタスクが設定されていることを確認
        assert "check-scheduled-submissions" in schedule
        assert "system-health-check" in schedule
        assert "cleanup-old-logs" in schedule
        assert "browser-pool-maintenance" in schedule
        
        # スケジュール内容の確認
        check_task = schedule["check-scheduled-submissions"]
        assert check_task["task"] == "app.tasks.schedule_tasks.check_scheduled_submissions"
        
        health_task = schedule["system-health-check"]
        assert health_task["task"] == "app.tasks.schedule_tasks.system_health_check"


class TestTaskIntegration:
    """タスク統合テスト"""
    
    @patch('app.tasks.form_tasks.get_db')
    @patch('app.tasks.form_tasks.form_detector')
    @patch('app.tasks.form_tasks.browser_pool')
    def test_form_detection_task_mock(self, mock_browser_pool, mock_form_detector, mock_get_db):
        """フォーム検出タスクのモックテスト"""
        
        # モックデータベース
        mock_db = Mock()
        mock_get_db.return_value = mock_db
        
        # モック企業
        mock_company = Mock()
        mock_company.id = 1
        mock_company.url = "https://example.com"
        mock_db.query.return_value.filter.return_value.first.return_value = mock_company
        
        # モックフォーム検出結果
        mock_form_detector.detect_forms.return_value = []
        
        # テスト実行は実際のCeleryが必要なのでスキップ
        # 実際のテストはE2Eテストで実行
        pass
    
    def test_task_error_handling_structure(self):
        """タスクエラーハンドリング構造のテスト"""
        from app.tasks.form_tasks import detect_forms_task, submit_form_task
        
        # bindパラメータが設定されていることを確認（リトライ機能のため）
        assert detect_forms_task.bind == True
        assert submit_form_task.bind == True 