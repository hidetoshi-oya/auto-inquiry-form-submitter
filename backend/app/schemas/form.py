from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from enum import Enum


class FormFieldType(str, Enum):
    """フォームフィールドタイプ"""
    TEXT = "text"
    EMAIL = "email"
    TEL = "tel"
    TEXTAREA = "textarea"
    SELECT = "select"
    RADIO = "radio"
    CHECKBOX = "checkbox"


class FormFieldBase(BaseModel):
    """フォームフィールド基本スキーマ"""
    name: str = Field(..., description="フィールド名")
    field_type: FormFieldType = Field(..., description="フィールドタイプ")
    selector: str = Field(..., description="CSSセレクタ")
    label: Optional[str] = Field(None, description="ラベル")
    required: bool = Field(default=False, description="必須フィールドかどうか")
    options: Optional[List[str]] = Field(None, description="選択肢（select/radio用）")


class FormFieldResponse(FormFieldBase):
    """フォームフィールドレスポンススキーマ"""
    id: int
    form_id: int
    
    class Config:
        from_attributes = True


class FormBase(BaseModel):
    """フォーム基本スキーマ"""
    company_id: int = Field(..., description="企業ID")
    form_url: str = Field(..., description="フォームURL")
    submit_button_selector: str = Field(..., description="送信ボタンのセレクタ")
    has_recaptcha: bool = Field(default=False, description="reCAPTCHAの有無")


class FormCreate(FormBase):
    """フォーム作成スキーマ"""
    fields: List[FormFieldBase] = Field(..., description="フォームフィールド")
    detected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="検出日時")


class FormResponse(FormBase):
    """フォームレスポンススキーマ"""
    id: int
    detected_at: datetime
    fields: List[FormFieldResponse]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class FormListResponse(BaseModel):
    """フォーム一覧レスポンススキーマ"""
    items: List[FormResponse]
    total: int
    page: int
    per_page: int
    pages: int


class FormDetectionRequest(BaseModel):
    """フォーム検出リクエストスキーマ"""
    company_id: int = Field(..., description="企業ID")
    force_refresh: bool = Field(default=False, description="キャッシュを無視して再検出")


# エイリアス
Form = FormResponse