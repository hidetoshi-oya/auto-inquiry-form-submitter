"""
テスト用データベース設定管理
"""
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.database import Base

# グローバルエンジンとセッション
test_engine = None
TestingSessionLocal = None


def setup_test_database():
    """テスト用データベースの設定を行う"""
    global test_engine, TestingSessionLocal
    
    if test_engine is not None:
        return test_engine, TestingSessionLocal
    
    # Docker環境のPostgreSQLを優先的に使用
    if os.getenv("TESTING") == "1" and os.getenv("DATABASE_URL"):
        database_url = os.getenv("DATABASE_URL")
        try:
            test_engine = create_engine(database_url, echo=False)
            # 接続テスト
            with test_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"✅ Docker PostgreSQLデータベースに接続: {database_url}")
        except Exception as e:
            print(f"⚠️  PostgreSQL接続失敗、SQLiteにフォールバック: {e}")
            # PostgreSQL接続失敗時はSQLiteにフォールバック
            test_engine = create_engine(
                "sqlite:///:memory:",
                connect_args={"check_same_thread": False},
                echo=False
            )
    else:
        # 通常のテスト環境ではSQLiteメモリデータベースを使用
        test_engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            echo=False
        )
        print("✅ SQLiteメモリデータベースを使用")
    
    # セッションファクトリー作成
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine
    )
    
    # テーブル作成
    Base.metadata.create_all(bind=test_engine)
    
    return test_engine, TestingSessionLocal


def get_test_engine():
    """テスト用エンジンを取得"""
    if test_engine is None:
        setup_test_database()
    return test_engine


def get_test_session_local():
    """テスト用セッションファクトリーを取得"""
    if TestingSessionLocal is None:
        setup_test_database()
    return TestingSessionLocal


def cleanup_test_database():
    """テストデータベースのクリーンアップ"""
    global test_engine
    if test_engine:
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()
        test_engine = None 