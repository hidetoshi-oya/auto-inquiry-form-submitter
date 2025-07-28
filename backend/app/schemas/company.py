from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, HttpUrl, Field, validator

from app.models.company import CompanyStatus


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


class CompanyResponse(CompanyBase):
    """企業レスポンススキーマ"""
    id: int
    last_submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
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