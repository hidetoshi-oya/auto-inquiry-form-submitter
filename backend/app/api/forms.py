from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.api import deps
from app.core.database import get_db
from app.models.form import Form
from app.models.company import Company
from app.models.user import User
from app.schemas.form import Form as FormSchema, FormDetectionRequest, FormResponse
from app.schemas.submission import SubmissionRequest, SubmissionResponse
from app.services.form_detector import form_detector
from app.services.form_submitter import form_submitter
from app.tasks.form_tasks import detect_forms_task, submit_form_task

router = APIRouter()


# 古いバックグラウンドタスクは削除（Celeryタスクに移行）


@router.post("/detect", response_model=dict)
async def detect_form(
    *,
    db: Session = Depends(get_db),
    request: FormDetectionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """企業のウェブサイトから問い合わせフォームを検出"""
    # 企業の存在確認
    company = db.query(Company).filter(Company.id == request.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # 強制リフレッシュでない場合は既存のフォームをチェック
    if not request.force_refresh:
        existing_forms = db.query(Form).filter(Form.company_id == company.id).all()
        if existing_forms:
            return {
                "message": "Forms already detected. Use force_refresh=true to re-detect.",
                "company_id": company.id,
                "existing_forms_count": len(existing_forms),
                "status": "existing"
            }
    
    # Celeryタスクでフォーム検出を実行
    task_result = detect_forms_task.apply_async(
        args=[company.id, request.force_refresh]
    )
    
    return {
        "message": "Form detection started",
        "company_id": company.id,
        "company_url": company.url,
        "task_id": task_result.task_id,
        "status": "processing"
    }


@router.get("/company/{company_id}", response_model=List[FormResponse])
def read_company_forms(
    *,
    db: Session = Depends(get_db),
    company_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """特定企業の検出済みフォーム一覧を取得"""
    forms = db.query(Form).filter(Form.company_id == company_id).all()
    return forms


@router.get("/{form_id}", response_model=FormResponse)
def read_form(
    *,
    db: Session = Depends(get_db),
    form_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """フォーム詳細を取得"""
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form


@router.post("/submit", response_model=SubmissionResponse)
async def submit_form(
    *,
    db: Session = Depends(get_db),
    request: SubmissionRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """フォームを自動入力・送信"""
    # フォームの存在確認
    form = db.query(Form).filter(Form.id == request.form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    try:
        # Celeryタスクでフォーム送信を実行
        task_result = submit_form_task.apply_async(
            args=[
                request.form_id,
                request.template_id,
                request.template_data,
                request.take_screenshot,
                request.dry_run
            ]
        )
        
        # タスクの結果を取得（非同期の場合は即座に返すかオプション）
        if request.dry_run:
            # ドライランの場合は結果を待つ
            result = task_result.get(timeout=30)
            if result.get("success"):
                return result.get("result", result)
            else:
                raise Exception(result.get("error", "Task failed"))
        else:
            # 通常送信の場合はタスクIDを返す
            return {
                "task_id": task_result.task_id,
                "status": "processing",
                "message": "Form submission started"
            }
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Form submission failed: {str(e)}")


@router.delete("/{form_id}")
def delete_form(
    *,
    db: Session = Depends(get_db),
    form_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """フォームを削除"""
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    db.delete(form)
    db.commit()
    
    return {"message": "Form deleted successfully"}