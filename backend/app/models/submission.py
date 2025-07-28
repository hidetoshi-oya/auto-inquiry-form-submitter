from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base
from app.models.base import TimestampMixin


class SubmissionStatus(str, enum.Enum):
    """送信ステータス"""
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    CAPTCHA_REQUIRED = "captcha_required"


class Submission(Base, TimestampMixin):
    """送信履歴モデル"""
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=False)
    form_id = Column(Integer, ForeignKey("forms.id"), nullable=True)
    status = Column(Enum(SubmissionStatus), default=SubmissionStatus.PENDING, nullable=False)
    submitted_data = Column(JSON, nullable=False)  # 送信したデータ
    response = Column(String, nullable=True)  # レスポンス内容
    error_message = Column(String, nullable=True)  # エラーメッセージ
    submitted_at = Column(DateTime, nullable=False)
    screenshot_url = Column(String, nullable=True)  # S3のスクリーンショットURL
    
    # リレーション
    company = relationship("Company", backref="submissions")
    template = relationship("Template", back_populates="submissions")
    form = relationship("Form", backref="submissions")