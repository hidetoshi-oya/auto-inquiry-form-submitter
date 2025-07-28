from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Template(Base, TimestampMixin):
    """テンプレートモデル"""
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    description = Column(String, nullable=True)
    
    # リレーション
    fields = relationship("TemplateField", back_populates="template", cascade="all, delete-orphan")
    variables = relationship("TemplateVariable", back_populates="template", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="template")


class TemplateField(Base):
    """テンプレートフィールドモデル"""
    __tablename__ = "template_fields"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=False)
    key = Column(String, nullable=False)  # フォームフィールドのキー
    value = Column(String, nullable=False)  # 値または変数名
    field_type = Column(String, nullable=False)  # static or variable
    
    # リレーション
    template = relationship("Template", back_populates="fields")


class TemplateVariable(Base):
    """テンプレート変数モデル"""
    __tablename__ = "template_variables"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=False)
    name = Column(String, nullable=False)  # 変数名（表示用）
    key = Column(String, nullable=False)  # 変数キー（{{key}}の形式で使用）
    default_value = Column(String, nullable=True)
    
    # リレーション
    template = relationship("Template", back_populates="variables")