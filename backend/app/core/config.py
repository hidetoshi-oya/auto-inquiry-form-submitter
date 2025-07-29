from typing import List
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl


class Settings(BaseSettings):
    # API設定
    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "Auto Inquiry Form Submitter"
    
    # データベース設定
    DATABASE_URL: str
    
    # Redis設定
    REDIS_URL: str
    
    # セキュリティ設定
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS設定
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    # Playwright設定
    PLAYWRIGHT_HEADLESS: bool = True
    PLAYWRIGHT_TIMEOUT: int = 30000
    
    # S3互換ストレージ設定
    S3_ENDPOINT_URL: str
    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    S3_BUCKET_NAME: str
    
    # Celery設定
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str
    
    # レート制限
    RATE_LIMIT_PER_MINUTE: int = 60
    
    # メール設定（オプション）
    EMAIL_ENABLED: bool = False
    EMAIL_HOST: str = ""
    EMAIL_PORT: int = 587
    EMAIL_USERNAME: str = ""
    EMAIL_PASSWORD: str = ""
    
    # デバッグ設定
    DEBUG: bool = True  # 開発環境用に一時的に有効化
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()