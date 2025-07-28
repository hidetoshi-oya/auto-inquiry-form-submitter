import asyncio
import pytest
import tempfile
from pathlib import Path
from unittest.mock import Mock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from tests.test_app import test_app as app
from app.core.database import get_db, Base
from app.api.deps import get_current_active_user
from app.models.user import User


# === Pytest Configuration ===
@pytest.fixture(scope="session")
def event_loop():
    """セッションスコープのイベントループ"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# === Database Fixtures ===
@pytest.fixture(scope="session")
def test_db_engine():
    """テスト用データベースエンジン"""
    from tests.test_db_config import get_test_engine, cleanup_test_database
    
    engine = get_test_engine()
    
    yield engine
    
    # セッション終了時にクリーンアップ
    cleanup_test_database()


@pytest.fixture(scope="function")
def test_db_session(test_db_engine):
    """テスト用データベースセッション（関数スコープ）"""
    from tests.test_db_config import get_test_session_local
    
    TestingSessionLocal = get_test_session_local()
    session = TestingSessionLocal()
    
    yield session
    
    # 各テスト後にロールバック
    session.rollback()
    session.close()


@pytest.fixture(scope="function")
def override_get_db(test_db_session):
    """データベース依存性のオーバーライド"""
    def _override_get_db():
        try:
            yield test_db_session
        finally:
            pass
    
    return _override_get_db


# === Authentication Fixtures ===
@pytest.fixture
def test_user():
    """テストユーザーのファクトリーフィクスチャー"""
    def _create_test_user(
        email: str = "test@example.com",
        username: str = "testuser",
        is_active: bool = True,
        is_superuser: bool = False
    ):
        return User(
            email=email,
            username=username,
            hashed_password="hashed_password_test",
            is_active=is_active,
            is_superuser=is_superuser
        )
    
    return _create_test_user


@pytest.fixture
def mock_current_user(test_user):
    """認証された現在のユーザーのモック"""
    return test_user()


@pytest.fixture
def override_get_current_user(mock_current_user):
    """認証依存性のオーバーライド"""
    def _override_get_current_user():
        return mock_current_user
    
    return _override_get_current_user


# === TestClient Fixtures ===
@pytest.fixture(scope="function")
def client(override_get_db, override_get_current_user):
    """FastAPIテストクライアント"""
    # 依存性のオーバーライド
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_active_user] = override_get_current_user
    
    with TestClient(app) as test_client:
        yield test_client
    
    # クリーンアップ
    app.dependency_overrides.clear()


@pytest.fixture(scope="function") 
def authenticated_client(client, mock_current_user):
    """認証済みテストクライアント"""
    # JWTトークンのモック
    client.headers.update({
        "Authorization": "Bearer test_token_12345"
    })
    return client


@pytest.fixture(scope="function")
def unauthenticated_client(override_get_db):
    """非認証テストクライアント"""
    # 認証なしのクライアント
    app.dependency_overrides[get_db] = override_get_db
    # 認証は含めない
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


# === Mock Fixtures ===
@pytest.fixture
def mock_browser_pool():
    """ブラウザプールのモック"""
    mock_pool = Mock()
    mock_browser = Mock()
    mock_page = Mock()
    
    mock_pool.get_browser.return_value = mock_browser
    mock_browser.new_page.return_value = mock_page
    mock_page.goto.return_value = Mock(ok=True, status=200)
    
    return mock_pool


@pytest.fixture 
def mock_celery_task():
    """Celeryタスクのモック"""
    def _mock_task(task_result=None, task_id="test_task_123"):
        mock_task = Mock()
        mock_task.apply_async.return_value = Mock(
            id=task_id,
            ready=lambda: True,
            get=lambda: task_result
        )
        return mock_task
    
    return _mock_task


@pytest.fixture
def mock_storage_client():
    """ストレージクライアントのモック"""
    mock_client = Mock()
    mock_client.put_object.return_value = "https://mock-s3.example.com/test.png"
    return mock_client


@pytest.fixture
def mock_email_service():
    """メールサービスのモック"""
    mock_service = Mock()
    mock_service.send_email.return_value = True
    return mock_service


# === Temporary Directory Fixtures ===
@pytest.fixture
def temp_dir():
    """一時ディレクトリ"""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield Path(temp_dir)


@pytest.fixture
def temp_file():
    """一時ファイル"""
    def _create_temp_file(content: str = "", suffix: str = ".txt"):
        with tempfile.NamedTemporaryFile(
            mode='w',
            suffix=suffix,
            delete=False
        ) as temp_file:
            temp_file.write(content)
            temp_file.flush()
            return Path(temp_file.name)
    
    return _create_temp_file


# === Sample Data Factories ===
@pytest.fixture
def sample_company_data():
    """サンプル企業データファクトリー"""
    def _create_company_data(
        name: str = "テスト企業",
        url: str = "https://example.com",
        memo: str = "テスト用の企業です"
    ):
        return {
            "name": name,
            "url": url,  # 文字列として直接返す（PydanticのHttpUrl正規化を避ける）
            "memo": memo,
            "status": "active",
            "meta_data": {"test": True}
        }
    
    return _create_company_data


@pytest.fixture
def sample_template_data():
    """サンプルテンプレートデータファクトリー"""
    def _create_template_data(
        name: str = "テストテンプレート",
        category: str = "general"
    ):
        return {
            "name": name,
            "category": category,
            "subject": "お問い合わせ",
            "content": "{{company_name}}様へ、お世話になっております。",
            "variables": [
                {"name": "company_name", "type": "string", "required": True},
                {"name": "contact_name", "type": "string", "required": True}
            ]
        }
    
    return _create_template_data


@pytest.fixture
def sample_form_data():
    """サンプルフォームデータファクトリー"""
    def _create_form_data(
        url: str = "https://example.com/contact",
        company_id: int = 1
    ):
        return {
            "company_id": company_id,
            "form_url": url,
            "fields": [
                {
                    "name": "name",
                    "type": "text",
                    "selector": "#name",
                    "required": True,
                    "label": "お名前"
                },
                {
                    "name": "email", 
                    "type": "email",
                    "selector": "#email",
                    "required": True,
                    "label": "メールアドレス"
                },
                {
                    "name": "message",
                    "type": "textarea", 
                    "selector": "#message",
                    "required": True,
                    "label": "お問い合わせ内容"
                }
            ],
            "submit_button_selector": "#submit"
        }
    
    return _create_form_data


# === Environment Variable Fixtures ===
@pytest.fixture
def mock_env_vars(monkeypatch):
    """環境変数のモック"""
    test_env_vars = {
        "DATABASE_URL": "sqlite:///:memory:",
        "REDIS_URL": "redis://localhost:6379/1",
        "SECRET_KEY": "test_secret_key_for_testing_only",
        "S3_ENDPOINT_URL": "http://localhost:9000",
        "S3_ACCESS_KEY": "test_access_key",
        "S3_SECRET_KEY": "test_secret_key",
        "S3_BUCKET_NAME": "test-bucket",
        "CELERY_BROKER_URL": "redis://localhost:6379/2",
        "CELERY_RESULT_BACKEND": "redis://localhost:6379/3"
    }
    
    for key, value in test_env_vars.items():
        monkeypatch.setenv(key, value)
    
    return test_env_vars


# === Async Fixtures (if needed) ===
@pytest.fixture
async def async_client(override_get_db, override_get_current_user):
    """非同期テストクライアント"""
    from httpx import AsyncClient
    
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_active_user] = override_get_current_user
    
    async with AsyncClient(app=app, base_url="http://testserver") as ac:
        yield ac
    
    app.dependency_overrides.clear()


# === Pytest Marks ===
def pytest_configure(config):
    """Pytestの設定"""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", "unit: marks tests as unit tests"
    )
    config.addinivalue_line(
        "markers", "e2e: marks tests as end-to-end tests"
    )


# === Auto-use Fixtures ===
@pytest.fixture(autouse=True)
def isolate_tests(monkeypatch):
    """各テストを分離"""
    # グローバル状態をリセット
    pass