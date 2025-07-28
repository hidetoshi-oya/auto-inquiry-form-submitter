from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    """ユーザー基本スキーマ"""
    email: EmailStr
    username: str
    is_active: bool = True
    is_superuser: bool = False


class UserCreate(UserBase):
    """ユーザー作成スキーマ"""
    password: str


class UserUpdate(UserBase):
    """ユーザー更新スキーマ"""
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None


class UserLogin(BaseModel):
    """ユーザーログインスキーマ"""
    username: str
    password: str


class UserInDBBase(UserBase):
    """DB内のユーザー基本スキーマ"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class User(UserInDBBase):
    """ユーザーレスポンススキーマ"""
    pass


class UserInDB(UserInDBBase):
    """DB内のユーザースキーマ（ハッシュ化パスワード含む）"""
    hashed_password: str


class Token(BaseModel):
    """トークンスキーマ"""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """トークンデータスキーマ"""
    username: Optional[str] = None