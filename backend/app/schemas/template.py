from typing import List, Optional, Dict, Any
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


# プレビュー関連スキーマ
class TemplatePreviewRequest(BaseModel):
    """テンプレートプレビューリクエスト"""
    template_content: str = Field(..., description="テンプレート内容")
    variables: Optional[Dict[str, str]] = Field(default_factory=dict, description="カスタム変数")


class TemplatePreviewResponse(BaseModel):
    """テンプレートプレビューレスポンス"""
    success: bool = Field(..., description="処理成功フラグ")
    preview: str = Field(..., description="プレビュー内容")
    variables_used: List[str] = Field(..., description="使用された変数リスト")
    available_variables: List[str] = Field(..., description="利用可能な変数リスト")
    error: Optional[str] = Field(None, description="エラーメッセージ")


class TemplateVariableDefinition(BaseModel):
    """テンプレート変数定義"""
    name: str = Field(..., description="変数名（表示用）")
    key: str = Field(..., description="変数キー")
    default_value: Optional[str] = Field(None, description="デフォルト値")
    description: Optional[str] = Field(None, description="説明")


class TemplateValidationResponse(BaseModel):
    """テンプレート検証レスポンス"""
    valid: bool = Field(..., description="テンプレートが有効かどうか")
    variables: List[str] = Field(..., description="抽出された変数リスト")
    error: Optional[str] = Field(None, description="エラーメッセージ")


class TemplateVariablesResponse(BaseModel):
    """テンプレート変数一覧レスポンス"""
    variables: List[TemplateVariableDefinition] = Field(..., description="変数定義リスト")


class TemplateCategoryStats(BaseModel):
    """テンプレートカテゴリ統計"""
    category: str = Field(..., description="カテゴリ名")
    count: int = Field(..., description="テンプレート数")
    last_updated: Optional[datetime] = Field(None, description="最終更新日時")


class TemplateCategoriesResponse(BaseModel):
    """テンプレートカテゴリ一覧レスポンス"""
    categories: List[TemplateCategoryStats] = Field(..., description="カテゴリ統計リスト")
    total_templates: int = Field(..., description="総テンプレート数")


# エイリアス
Template = TemplateResponse