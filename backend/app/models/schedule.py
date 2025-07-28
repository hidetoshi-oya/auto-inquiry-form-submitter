from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Schedule(Base, TimestampMixin):
    """スケジュールモデル"""
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=False)
    company_ids = Column(JSON, nullable=False)  # 対象企業IDのリスト
    cron_expression = Column(String, nullable=False)  # cron形式のスケジュール
    enabled = Column(Boolean, default=True)
    last_run_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=False)
    
    # リレーション
    template = relationship("Template", backref="schedules")