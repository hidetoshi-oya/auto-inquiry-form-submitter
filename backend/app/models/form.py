from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Form(Base, TimestampMixin):
    """フォーム情報モデル"""
    __tablename__ = "forms"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    form_url = Column(String, nullable=False)
    submit_button_selector = Column(String, nullable=False)
    has_recaptcha = Column(Boolean, default=False)
    detected_at = Column(DateTime, nullable=False)
    
    # リレーション
    company = relationship("Company", backref="forms")
    fields = relationship("FormField", back_populates="form", cascade="all, delete-orphan")


class FormField(Base):
    """フォームフィールドモデル"""
    __tablename__ = "form_fields"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id"), nullable=False)
    name = Column(String, nullable=False)
    field_type = Column(String, nullable=False)  # text, email, tel, textarea, select, radio, checkbox
    selector = Column(String, nullable=False)
    label = Column(String, nullable=True)
    required = Column(Boolean, default=False)
    options = Column(JSON, nullable=True)  # selectやradioの選択肢
    
    # リレーション
    form = relationship("Form", back_populates="fields")