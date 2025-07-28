from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field, HttpUrl

from app.models.submission import SubmissionStatus


class SubmissionBase(BaseModel):
    """送信履歴基本スキーマ"""
    company_id: int = Field(..., description="企業ID")
    template_id: int = Field(..., description="テンプレートID")
    form_id: Optional[int] = Field(None, description="フォームID")
    submitted_data: Dict[str, Any] = Field(..., description="送信データ")


class SubmissionCreate(SubmissionBase):
    """送信履歴作成スキーマ"""
    status: SubmissionStatus = Field(default=SubmissionStatus.PENDING, description="ステータス")
    response: Optional[str] = Field(None, description="レスポンス内容")
    error_message: Optional[str] = Field(None, description="エラーメッセージ")
    screenshot_url: Optional[HttpUrl] = Field(None, description="スクリーンショットURL")
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="送信日時")


class SubmissionResponse(SubmissionBase):
    """送信履歴レスポンススキーマ"""
    id: int
    status: SubmissionStatus
    response: Optional[str] = None
    error_message: Optional[str] = None
    submitted_at: datetime
    screenshot_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    # リレーション情報（必要に応じて含める）
    company_name: Optional[str] = None
    template_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class SubmissionListResponse(BaseModel):
    """送信履歴一覧レスポンススキーマ"""
    items: List[SubmissionResponse]
    total: int
    page: int
    per_page: int
    pages: int


class SubmissionRequest(BaseModel):
    """フォーム送信リクエストスキーマ"""
    form_id: int = Field(..., description="フォームID")
    template_id: int = Field(..., description="テンプレートID")
    template_data: Dict[str, Any] = Field(..., description="テンプレートデータ")
    take_screenshot: bool = Field(default=True, description="スクリーンショット撮影")
    dry_run: bool = Field(default=False, description="ドライラン（実際に送信しない）")


class SubmissionBatchCreate(BaseModel):
    """バッチ送信作成スキーマ"""
    company_ids: List[int] = Field(..., min_items=1, description="企業IDリスト")
    template_id: int = Field(..., description="テンプレートID")
    interval_seconds: int = Field(default=30, ge=1, le=300, description="送信間隔（秒）")
    test_mode: bool = Field(default=False, description="テストモード（実際に送信しない）")


# エイリアス
Submission = SubmissionResponse