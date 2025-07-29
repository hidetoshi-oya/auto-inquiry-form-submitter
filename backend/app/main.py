from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from app.api import auth, companies, forms, templates, submissions, schedules, compliance, tasks
from app.core.config import settings
from app.core.database import engine, Base
from app.core.middleware import (
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
    InputValidationMiddleware,
    LoggingMiddleware
)

# データベーステーブルの作成
@asynccontextmanager
async def lifespan(app: FastAPI):
    # アプリ起動時
    Base.metadata.create_all(bind=engine)
    yield
    # アプリ終了時の処理（必要に応じて）

app = FastAPI(
    title="Auto Inquiry Form Submitter",
    description="企業サイトの問い合わせフォーム自動送信サービス",
    version="1.0.0",
    lifespan=lifespan
)

# 422 エラーの詳細ログ用例外ハンドラー
logger = logging.getLogger(__name__)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"422 Validation Error on {request.method} {request.url.path}")
    logger.error(f"Request headers: {dict(request.headers)}")
    logger.error(f"Validation errors: {exc.errors()}")
    logger.error(f"Request body: {exc.body}")
    
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}
    )

# セキュリティミドルウェアの追加（順序重要）
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, exempt_paths=["/health", "/docs", "/openapi.json", "/redoc"])
app.add_middleware(InputValidationMiddleware)
app.add_middleware(LoggingMiddleware)

# CORS設定（開発環境用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS if settings.ALLOWED_ORIGINS != ["*"] else ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"]
)

# APIルーターの登録
app.include_router(auth.router, prefix="/api/auth", tags=["認証"])
app.include_router(companies.router, prefix="/api/companies", tags=["企業管理"])
app.include_router(forms.router, prefix="/api/forms", tags=["フォーム検出・送信"])
app.include_router(templates.router, prefix="/api/templates", tags=["テンプレート管理"])
app.include_router(submissions.router, prefix="/api/submissions", tags=["送信履歴"])
app.include_router(schedules.router, prefix="/api/schedules", tags=["スケジュール管理"])
app.include_router(compliance.router, prefix="/api/compliance", tags=["コンプライアンス"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["タスク管理"])

# ヘルスチェックエンドポイント
@app.get("/health")
async def health_check():
    """システムの健全性チェック"""
    return {
        "status": "healthy",
        "service": "Auto Inquiry Form Submitter",
        "version": "1.0.0"
    }

# セキュリティ情報エンドポイント
@app.get("/security")
async def security_info():
    """セキュリティ設定情報（デバッグ用）"""
    if not settings.DEBUG:
        return {"error": "Not available in production"}
    
    return {
        "csrf_protection": "enabled",
        "rate_limiting": "enabled",
        "security_headers": "enabled",
        "input_validation": "enabled",
        "robots_txt_compliance": "enabled",
        "compliance_manager": "enabled"
    }

# robots.txtエンドポイント
@app.get("/robots.txt")
async def robots_txt():
    """robots.txt配信"""
    content = """User-agent: *
Allow: /

User-agent: AutoInquiryBot
Allow: /

Crawl-delay: 1
Sitemap: /sitemap.xml
"""
    return content

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)