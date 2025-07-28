from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.core.database import get_db
from app.models.template import Template
from app.models.user import User
from app.schemas.template import Template as TemplateSchema, TemplateCreate, TemplateUpdate

router = APIRouter()


@router.get("/", response_model=List[TemplateSchema])
def read_templates(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    category: str = None,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """テンプレート一覧を取得"""
    query = db.query(Template)
    if category:
        query = query.filter(Template.category == category)
    templates = query.offset(skip).limit(limit).all()
    return templates


@router.post("/", response_model=TemplateSchema)
def create_template(
    *,
    db: Session = Depends(get_db),
    template_in: TemplateCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """新規テンプレートを作成"""
    template = Template(**template_in.dict())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/{template_id}", response_model=TemplateSchema)
def read_template(
    *,
    db: Session = Depends(get_db),
    template_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """テンプレート詳細を取得"""
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.put("/{template_id}", response_model=TemplateSchema)
def update_template(
    *,
    db: Session = Depends(get_db),
    template_id: int,
    template_in: TemplateUpdate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """テンプレートを更新"""
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = template_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}", response_model=TemplateSchema)
def delete_template(
    *,
    db: Session = Depends(get_db),
    template_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """テンプレートを削除"""
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    db.delete(template)
    db.commit()
    return template