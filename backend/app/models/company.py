from sqlalchemy import Column, Integer, String, DateTime, Enum, JSON
import enum

from app.core.database import Base
from app.models.base import TimestampMixin


class CompanyStatus(str, enum.Enum):
    """企業ステータス"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    BLOCKED = "blocked"


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