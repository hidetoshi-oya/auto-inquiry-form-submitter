from typing import Any, List, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc

from app.api import deps
from app.core.database import get_db
from app.models.submission import Submission
from app.models.company import Company
from app.models.template import Template
from app.models.form import Form
from app.models.user import User
from app.schemas.submission import (
    SubmissionResponse,
    SubmissionListResponse,
    SubmissionBatchCreate,
    SubmissionRequest,
    SubmissionStatus
)
from app.services.form_submitter import form_submitter
from app.tasks.batch_tasks import batch_submission
from app.tasks.form_tasks import submit_form_task

router = APIRouter()


# 古いバッチ送信実装は削除（Celeryタスクに移行）


@router.get("/", response_model=SubmissionListResponse)
def read_submissions(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    page: int = Query(1, ge=1, description="ページ番号"),
    per_page: int = Query(20, ge=1, le=100, description="1ページあたりの件数"),
    company_id: Optional[int] = Query(None, description="企業IDでフィルタ"),
    status: Optional[SubmissionStatus] = Query(None, description="ステータスでフィルタ"),
    start_date: Optional[datetime] = Query(None, description="開始日時"),
    end_date: Optional[datetime] = Query(None, description="終了日時"),
) -> Any:
    """送信履歴一覧を取得"""
    
    query = db.query(Submission)
    
    # フィルタリング
    filters = []
    
    if company_id:
        filters.append(Submission.company_id == company_id)
    
    if status:
        filters.append(Submission.status == status)
    
    if start_date:
        filters.append(Submission.submitted_at >= start_date)
    
    if end_date:
        filters.append(Submission.submitted_at <= end_date)
    
    if filters:
        query = query.filter(and_(*filters))
    
    # 総件数を取得
    total = query.count()
    
    # ページネーション
    offset = (page - 1) * per_page
    submissions = (
        query.order_by(desc(Submission.submitted_at))
        .offset(offset)
        .limit(per_page)
        .all()
    )
    
    # ページ数を計算
    pages = (total + per_page - 1) // per_page
    
    return SubmissionListResponse(
        items=submissions,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.get("/{submission_id}", response_model=SubmissionResponse)
def read_submission(
    *,
    db: Session = Depends(get_db),
    submission_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """送信履歴詳細を取得"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    return submission


@router.post("/batch", response_model=dict)
async def create_batch_submission(
    *,
    db: Session = Depends(get_db),
    request: SubmissionBatchCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """バッチ送信を実行"""
    
    # 企業IDの妥当性確認
    companies = db.query(Company).filter(Company.id.in_(request.company_ids)).all()
    if len(companies) != len(request.company_ids):
        missing_ids = set(request.company_ids) - {c.id for c in companies}
        raise HTTPException(
            status_code=400,
            detail=f"Companies not found: {list(missing_ids)}"
        )
    
    # テンプレートの存在確認
    template = db.query(Template).filter(Template.id == request.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Celeryタスクでバッチ送信を実行
    task_result = batch_submission.apply_async(
        args=[
            request.company_ids,
            request.template_id,
            request.interval_seconds,
            request.test_mode,
            True  # take_screenshot
        ]
    )
    
    return {
        "message": "Batch submission started",
        "company_count": len(request.company_ids),
        "template_id": request.template_id,
        "interval_seconds": request.interval_seconds,
        "test_mode": request.test_mode,
        "task_id": task_result.task_id,
        "status": "processing"
    }


@router.post("/single", response_model=dict)
async def create_single_submission(
    *,
    db: Session = Depends(get_db),
    request: SubmissionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """単一フォーム送信を実行"""
    
    # フォームの存在確認
    form = db.query(Form).filter(Form.id == request.form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # テンプレートの存在確認
    template = db.query(Template).filter(Template.id == request.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
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
    
    return {
        "message": "Form submission started" if not request.dry_run else "Dry run started",
        "form_id": request.form_id,
        "template_id": request.template_id,
        "dry_run": request.dry_run,
        "task_id": task_result.task_id,
        "status": "processing"
    }


@router.get("/company/{company_id}/latest", response_model=Optional[SubmissionResponse])
def read_latest_submission_by_company(
    *,
    db: Session = Depends(get_db),
    company_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """企業の最新送信履歴を取得"""
    submission = (
        db.query(Submission)
        .filter(Submission.company_id == company_id)
        .order_by(desc(Submission.submitted_at))
        .first()
    )
    
    return submission


@router.get("/stats", response_model=dict)
def read_submission_stats(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    days: int = Query(30, ge=1, le=365, description="過去の日数"),
) -> Any:
    """送信統計を取得"""
    
    # 期間を計算
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    # 基本統計
    total_submissions = db.query(Submission).count()
    recent_submissions = (
        db.query(Submission)
        .filter(Submission.submitted_at >= start_date)
        .count()
    )
    
    # ステータス別統計
    status_stats = {}
    for status in SubmissionStatus:
        count = (
            db.query(Submission)
            .filter(
                and_(
                    Submission.status == status,
                    Submission.submitted_at >= start_date
                )
            )
            .count()
        )
        status_stats[status.value] = count
    
    # 成功率
    success_count = status_stats.get(SubmissionStatus.SUCCESS.value, 0)
    success_rate = (success_count / recent_submissions * 100) if recent_submissions > 0 else 0
    
    return {
        "period_days": days,
        "total_submissions": total_submissions,
        "recent_submissions": recent_submissions,
        "success_rate": round(success_rate, 2),
        "status_breakdown": status_stats,
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
    }


@router.delete("/{submission_id}")
def delete_submission(
    *,
    db: Session = Depends(get_db),
    submission_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """送信履歴を削除"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    db.delete(submission)
    db.commit()
    
    return {"message": "Submission deleted successfully"}