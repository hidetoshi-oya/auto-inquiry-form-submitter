"""
テスト専用のFastAPIアプリケーション設定
"""
from contextlib import asynccontextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, companies, forms, templates, submissions, schedules, compliance
from app.core.database import Base
from app.core.middleware import (
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
    InputValidationMiddleware,
    LoggingMiddleware
)


@asynccontextmanager
async def test_lifespan(app: FastAPI):
    """テスト用ライフサイクル管理"""
    from tests.test_db_config import setup_test_database
    
    # テスト用データベースの設定
    test_engine, TestingSessionLocal = setup_test_database()
    
    yield
    # クリーンアップは conftest.py で行う


# テスト用FastAPIアプリケーション
def create_test_app() -> FastAPI:
    """テスト専用のFastAPIアプリケーションを作成"""
    
    app = FastAPI(
        title="Auto Inquiry Form Submitter - Test",
        description="企業サイトの問い合わせフォーム自動送信サービス（テスト環境）",
        version="1.0.0-test",
        lifespan=test_lifespan
    )

    # CORSミドルウェア
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # セキュリティミドルウェア（テスト用は簡略化）
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware, exempt_paths=["/health", "/docs", "/openapi.json", "/redoc"])
    app.add_middleware(InputValidationMiddleware)
    app.add_middleware(LoggingMiddleware)

    # ルーター追加
    app.include_router(auth.router, prefix="/api/auth", tags=["認証"])
    app.include_router(companies.router, prefix="/api/companies", tags=["企業管理"])
    app.include_router(forms.router, prefix="/api/forms", tags=["フォーム検出"])
    app.include_router(templates.router, prefix="/api/templates", tags=["テンプレート管理"])
    app.include_router(submissions.router, prefix="/api/submissions", tags=["送信履歴"])
    app.include_router(schedules.router, prefix="/api/schedules", tags=["スケジュール管理"])
    app.include_router(compliance.router, prefix="/api/compliance", tags=["コンプライアンス"])

    # ヘルスチェックエンドポイント
    @app.get("/health")
    async def health():
        """システムの健全性チェック"""
        return {
            "status": "healthy",
            "service": "Auto Inquiry Form Submitter",
            "version": "1.0.0-test",
            "environment": "test"
        }

    # セキュリティ情報エンドポイント
    @app.get("/security")
    async def security_info():
        """セキュリティ情報（テスト環境）"""
        return {
            "csrf_protection": "enabled",
            "rate_limiting": "enabled", 
            "security_headers": "enabled",
            "input_validation": "enabled",
            "robots_txt_compliance": "enabled",
            "compliance_manager": "enabled",
            "environment": "test"
        }

    # robots.txtエンドポイント
    @app.get("/robots.txt", response_class=None)
    async def robots_txt():
        """robots.txtファイル（テスト用）"""
        content = """
User-agent: *
Allow: /

User-agent: AutoInquiryBot
Allow: /
Crawl-delay: 1
        """.strip()
        
        return content

    return app


# テスト用アプリケーションインスタンス
test_app = create_test_app() 