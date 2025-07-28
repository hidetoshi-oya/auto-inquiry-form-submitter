from sqlalchemy import Column, Integer, String, DateTime, Enum, JSON, Text
import enum
from typing import Optional

from app.core.database import Base
from app.models.base import TimestampMixin


class CompanyStatus(str, enum.Enum):
    """企業ステータス"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    BLOCKED = "blocked"


class FormDetectionStatus(str, enum.Enum):
    """フォーム検出ステータス"""
    NOT_STARTED = "not_started"    # 未開始
    IN_PROGRESS = "in_progress"    # 進行中
    COMPLETED = "completed"        # 完了
    ERROR = "error"                # エラー


class Company(Base, TimestampMixin):
    """企業モデル"""
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    url = Column(String, nullable=False, unique=True)
    last_submitted_at = Column(DateTime, nullable=True)
    status = Column(Enum(CompanyStatus), default=CompanyStatus.ACTIVE, nullable=False)
    meta_data = Column(JSON, default={})
    memo = Column(String, nullable=True)
    
    # フォーム検出関連フィールド
    form_detection_status = Column(
        Enum(FormDetectionStatus), 
        default=FormDetectionStatus.NOT_STARTED, 
        nullable=False,
        comment="フォーム検出ステータス"
    )
    form_detection_completed_at = Column(
        DateTime, 
        nullable=True,
        comment="フォーム検出完了日時"
    )
    detected_forms_count = Column(
        Integer, 
        default=0, 
        nullable=False,
        comment="検出されたフォーム数"
    )
    form_detection_error_message = Column(
        Text, 
        nullable=True,
        comment="フォーム検出エラーメッセージ"
    )