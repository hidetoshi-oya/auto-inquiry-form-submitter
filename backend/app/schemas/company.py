from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, HttpUrl, Field, validator

from app.models.company import CompanyStatus, FormDetectionStatus


class CompanyBase(BaseModel):
    """企業基本スキーマ"""
    name: str = Field(..., min_length=1, max_length=255, description="企業名")
    url: HttpUrl = Field(..., description="企業URL")
    status: CompanyStatus = Field(default=CompanyStatus.ACTIVE, description="ステータス")
    meta_data: Dict[str, Any] = Field(default_factory=dict, description="メタデータ")
    memo: Optional[str] = Field(None, max_length=1000, description="メモ")


class CompanyCreate(CompanyBase):
    """企業作成スキーマ"""
    pass


class CompanyUpdate(BaseModel):
    """企業更新スキーマ"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    url: Optional[HttpUrl] = None
    status: Optional[CompanyStatus] = None
    meta_data: Optional[Dict[str, Any]] = None
    memo: Optional[str] = Field(None, max_length=1000)
    form_detection_status: Optional[FormDetectionStatus] = Field(None, description="フォーム検出ステータス")
    form_detection_error_message: Optional[str] = Field(None, description="フォーム検出エラーメッセージ")


class CompanyResponse(CompanyBase):
    """企業レスポンススキーマ"""
    id: int
    last_submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    # フォーム検出関連フィールド
    form_detection_status: FormDetectionStatus = Field(description="フォーム検出ステータス")
    form_detection_completed_at: Optional[datetime] = Field(None, description="フォーム検出完了日時")
    detected_forms_count: int = Field(description="検出されたフォーム数")
    form_detection_error_message: Optional[str] = Field(None, description="フォーム検出エラーメッセージ")
    
    class Config:
        from_attributes = True


class CompanyListResponse(BaseModel):
    """企業一覧レスポンススキーマ"""
    items: List[CompanyResponse]
    total: int
    page: int
    per_page: int
    pages: int


# エイリアス
Company = CompanyResponse