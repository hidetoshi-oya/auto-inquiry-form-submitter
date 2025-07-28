from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, validator
import re


class ScheduleBase(BaseModel):
    """スケジュール基本スキーマ"""
    name: str = Field(..., min_length=1, max_length=255, description="スケジュール名")
    template_id: int = Field(..., description="テンプレートID")
    company_ids: List[int] = Field(..., min_items=1, description="対象企業IDリスト")
    cron_expression: str = Field(..., description="Cron式")
    enabled: bool = Field(default=True, description="有効/無効")
    
    @validator('cron_expression')
    def validate_cron(cls, v):
        """Cron式の基本的な検証"""
        # 簡単な検証（5つまたは6つのフィールド）
        fields = v.split()
        if len(fields) not in [5, 6]:
            raise ValueError('Cron式は5つまたは6つのフィールドを持つ必要があります')
        return v


class ScheduleCreate(ScheduleBase):
    """スケジュール作成スキーマ"""
    next_run_at: Optional[datetime] = None


class ScheduleUpdate(BaseModel):
    """スケジュール更新スキーマ"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    template_id: Optional[int] = None
    company_ids: Optional[List[int]] = Field(None, min_items=1)
    cron_expression: Optional[str] = None
    enabled: Optional[bool] = None
    
    @validator('cron_expression')
    def validate_cron(cls, v):
        if v is not None:
            fields = v.split()
            if len(fields) not in [5, 6]:
                raise ValueError('Cron式は5つまたは6つのフィールドを持つ必要があります')
        return v


class ScheduleResponse(ScheduleBase):
    """スケジュールレスポンススキーマ"""
    id: int
    last_run_at: Optional[datetime] = None
    next_run_at: datetime
    created_at: datetime
    updated_at: datetime
    
    # リレーション情報（必要に応じて含める）
    template_name: Optional[str] = None
    company_names: Optional[List[str]] = None
    
    class Config:
        from_attributes = True


class ScheduleListResponse(BaseModel):
    """スケジュール一覧レスポンススキーマ"""
    items: List[ScheduleResponse]
    total: int
    page: int
    per_page: int
    pages: int


# エイリアス
Schedule = ScheduleResponse