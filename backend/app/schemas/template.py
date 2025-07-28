from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class TemplateFieldType(str, Enum):
    """テンプレートフィールドタイプ"""
    STATIC = "static"
    VARIABLE = "variable"


class TemplateFieldBase(BaseModel):
    """テンプレートフィールド基本スキーマ"""
    key: str = Field(..., description="フィールドキー")
    value: str = Field(..., description="値または変数名")
    field_type: TemplateFieldType = Field(..., description="フィールドタイプ")


class TemplateFieldCreate(TemplateFieldBase):
    """テンプレートフィールド作成スキーマ"""
    pass


class TemplateFieldResponse(TemplateFieldBase):
    """テンプレートフィールドレスポンススキーマ"""
    id: int
    template_id: int
    
    class Config:
        from_attributes = True


class TemplateVariableBase(BaseModel):
    """テンプレート変数基本スキーマ"""
    name: str = Field(..., description="変数名（表示用）")
    key: str = Field(..., pattern=r"^[a-zA-Z_][a-zA-Z0-9_]*$", description="変数キー")
    default_value: Optional[str] = Field(None, description="デフォルト値")


class TemplateVariableCreate(TemplateVariableBase):
    """テンプレート変数作成スキーマ"""
    pass


class TemplateVariableResponse(TemplateVariableBase):
    """テンプレート変数レスポンススキーマ"""
    id: int
    template_id: int
    
    class Config:
        from_attributes = True


class TemplateBase(BaseModel):
    """テンプレート基本スキーマ"""
    name: str = Field(..., min_length=1, max_length=255, description="テンプレート名")
    category: str = Field(..., min_length=1, max_length=100, description="カテゴリ")
    description: Optional[str] = Field(None, max_length=1000, description="説明")


class TemplateCreate(TemplateBase):
    """テンプレート作成スキーマ"""
    fields: List[TemplateFieldCreate] = Field(..., description="テンプレートフィールド")
    variables: List[TemplateVariableCreate] = Field(default_factory=list, description="テンプレート変数")


class TemplateUpdate(BaseModel):
    """テンプレート更新スキーマ"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    fields: Optional[List[TemplateFieldCreate]] = None
    variables: Optional[List[TemplateVariableCreate]] = None


class TemplateResponse(TemplateBase):
    """テンプレートレスポンススキーマ"""
    id: int
    fields: List[TemplateFieldResponse]
    variables: List[TemplateVariableResponse]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TemplateListResponse(BaseModel):
    """テンプレート一覧レスポンススキーマ"""
    items: List[TemplateResponse]
    total: int
    page: int
    per_page: int
    pages: int


# エイリアス
Template = TemplateResponse