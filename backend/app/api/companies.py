from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.core.database import get_db
from app.models.company import Company
from app.models.user import User
from app.schemas.company import Company as CompanySchema, CompanyCreate, CompanyUpdate

router = APIRouter()


@router.get("/", response_model=List[CompanySchema])
def read_companies(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    # current_user: User = Depends(deps.get_current_active_user),  # 一時的に認証無効化
) -> Any:
    """企業一覧を取得"""
    companies = db.query(Company).offset(skip).limit(limit).all()
    return companies


@router.post("/", response_model=CompanySchema)
def create_company(
    *,
    db: Session = Depends(get_db),
    company_in: CompanyCreate,
    # current_user: User = Depends(deps.get_current_active_user),  # 一時的に認証無効化
) -> Any:
    """新規企業を追加"""
    # URL重複チェック（HttpUrlを文字列に変換）
    url_str = str(company_in.url)
    existing = db.query(Company).filter(Company.url == url_str).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Company with this URL already exists"
        )
    
    # PydanticモデルからSQLAlchemyモデルへの変換（HttpUrlを文字列に変換）
    company_data = company_in.model_dump()
    company_data["url"] = url_str
    company = Company(**company_data)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.get("/{company_id}", response_model=CompanySchema)
def read_company(
    *,
    db: Session = Depends(get_db),
    company_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """企業詳細を取得"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.put("/{company_id}", response_model=CompanySchema)
def update_company(
    *,
    db: Session = Depends(get_db),
    company_id: int,
    company_in: CompanyUpdate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """企業情報を更新"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    update_data = company_in.model_dump(exclude_unset=True)
    # HttpUrlオブジェクトを文字列に変換
    if "url" in update_data and update_data["url"] is not None:
        update_data["url"] = str(update_data["url"])
    
    for field, value in update_data.items():
        setattr(company, field, value)
    
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}", response_model=CompanySchema)
def delete_company(
    *,
    db: Session = Depends(get_db),
    company_id: int,
    # current_user: User = Depends(deps.get_current_active_user),  # 一時的に認証無効化
) -> Any:
    """企業を削除"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    db.delete(company)
    db.commit()
    return company