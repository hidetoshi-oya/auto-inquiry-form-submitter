from typing import Any, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api import deps
from app.core.database import get_db
from app.models.schedule import Schedule
from app.models.company import Company
from app.models.template import Template
from app.models.user import User
from app.schemas.schedule import (
    ScheduleResponse,
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleListResponse
)
from app.tasks.schedule_tasks import create_schedule, calculate_next_run_time

router = APIRouter()


@router.post("/", response_model=ScheduleResponse)
async def create_new_schedule(
    *,
    db: Session = Depends(get_db),
    schedule_in: ScheduleCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """新しいスケジュールを作成"""
    
    # Celeryタスクで作成を実行
    task_result = await create_schedule.apply_async(
        args=[
            schedule_in.name,
            schedule_in.company_ids,
            schedule_in.template_id,
            schedule_in.cron_expression,
            schedule_in.enabled
        ]
    )
    
    result = task_result.get()
    
    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Schedule creation failed")
        )
    
    # 作成されたスケジュールを取得
    schedule = db.query(Schedule).filter(
        Schedule.id == result["schedule"]["id"]
    ).first()
    
    return schedule


@router.get("/", response_model=ScheduleListResponse)
def read_schedules(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    page: int = Query(1, ge=1, description="ページ番号"),
    per_page: int = Query(20, ge=1, le=100, description="1ページあたりの件数"),
    enabled: Optional[bool] = Query(None, description="有効/無効でフィルタ"),
) -> Any:
    """スケジュール一覧を取得"""
    
    query = db.query(Schedule)
    
    # フィルタリング
    if enabled is not None:
        query = query.filter(Schedule.enabled == enabled)
    
    # 総件数を取得
    total = query.count()
    
    # ページネーション
    offset = (page - 1) * per_page
    schedules = (
        query.order_by(desc(Schedule.created_at))
        .offset(offset)
        .limit(per_page)
        .all()
    )
    
    # ページ数を計算
    pages = (total + per_page - 1) // per_page
    
    return ScheduleListResponse(
        items=schedules,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.get("/{schedule_id}", response_model=ScheduleResponse)
def read_schedule(
    *,
    db: Session = Depends(get_db),
    schedule_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """スケジュール詳細を取得"""
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    return schedule


@router.put("/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(
    *,
    db: Session = Depends(get_db),
    schedule_id: int,
    schedule_in: ScheduleUpdate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """スケジュールを更新"""
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # 更新データを適用
    update_data = schedule_in.dict(exclude_unset=True)
    
    # cron式が変更された場合は次回実行時刻を再計算
    if "cron_expression" in update_data:
        try:
            next_run = calculate_next_run_time(
                update_data["cron_expression"],
                datetime.now(timezone.utc)
            )
            update_data["next_run_at"] = next_run
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid cron expression: {str(e)}"
            )
    
    # 企業IDが変更された場合は妥当性をチェック
    if "company_ids" in update_data:
        companies = db.query(Company).filter(
            Company.id.in_(update_data["company_ids"])
        ).all()
        if len(companies) != len(update_data["company_ids"]):
            missing_ids = set(update_data["company_ids"]) - {c.id for c in companies}
            raise HTTPException(
                status_code=400,
                detail=f"Companies not found: {list(missing_ids)}"
            )
    
    # テンプレートIDが変更された場合は妥当性をチェック
    if "template_id" in update_data:
        template = db.query(Template).filter(
            Template.id == update_data["template_id"]
        ).first()
        if not template:
            raise HTTPException(
                status_code=400,
                detail=f"Template not found: {update_data['template_id']}"
            )
    
    # 更新を適用
    for field, value in update_data.items():
        setattr(schedule, field, value)
    
    db.commit()
    db.refresh(schedule)
    
    return schedule


@router.delete("/{schedule_id}")
def delete_schedule(
    *,
    db: Session = Depends(get_db),
    schedule_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """スケジュールを削除"""
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    db.delete(schedule)
    db.commit()
    
    return {"message": "Schedule deleted successfully"}


@router.post("/{schedule_id}/enable")
def enable_schedule(
    *,
    db: Session = Depends(get_db),
    schedule_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """スケジュールを有効化"""
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    schedule.enabled = True
    
    # 次回実行時刻を再計算
    try:
        next_run = calculate_next_run_time(
            schedule.cron_expression,
            datetime.now(timezone.utc)
        )
        schedule.next_run_at = next_run
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot enable schedule with invalid cron expression: {str(e)}"
        )
    
    db.commit()
    db.refresh(schedule)
    
    return {"message": "Schedule enabled successfully", "schedule": schedule}


@router.post("/{schedule_id}/disable")
def disable_schedule(
    *,
    db: Session = Depends(get_db),
    schedule_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """スケジュールを無効化"""
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    schedule.enabled = False
    db.commit()
    db.refresh(schedule)
    
    return {"message": "Schedule disabled successfully", "schedule": schedule}


@router.post("/{schedule_id}/run-now")
async def run_schedule_now(
    *,
    db: Session = Depends(get_db),
    schedule_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """スケジュールを即座に実行"""
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # バッチ送信を実行
    from app.tasks.batch_tasks import batch_submission
    
    task_result = batch_submission.apply_async(
        args=[
            schedule.company_ids,
            schedule.template_id,
            30,  # interval_seconds
            False,  # dry_run
            True  # take_screenshot
        ]
    )
    
    # 最終実行時刻を更新
    schedule.last_run_at = datetime.now(timezone.utc)
    db.commit()
    
    return {
        "message": "Schedule execution started",
        "schedule_id": schedule.id,
        "schedule_name": schedule.name,
        "task_id": task_result.task_id,
        "companies_count": len(schedule.company_ids)
    }


@router.get("/stats/overview")
def get_schedule_stats(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """スケジュール統計を取得"""
    
    # 基本統計
    total_schedules = db.query(Schedule).count()
    enabled_schedules = db.query(Schedule).filter(Schedule.enabled == True).count()
    disabled_schedules = total_schedules - enabled_schedules
    
    # 次回実行予定のスケジュール
    now = datetime.now(timezone.utc)
    upcoming_schedules = (
        db.query(Schedule)
        .filter(
            Schedule.enabled == True,
            Schedule.next_run_at.isnot(None)
        )
        .order_by(Schedule.next_run_at)
        .limit(5)
        .all()
    )
    
    # 最近実行されたスケジュール
    recent_schedules = (
        db.query(Schedule)
        .filter(Schedule.last_run_at.isnot(None))
        .order_by(desc(Schedule.last_run_at))
        .limit(5)
        .all()
    )
    
    return {
        "total_schedules": total_schedules,
        "enabled_schedules": enabled_schedules,
        "disabled_schedules": disabled_schedules,
        "upcoming_schedules": [
            {
                "id": s.id,
                "name": s.name,
                "next_run_at": s.next_run_at.isoformat() if s.next_run_at else None,
                "company_count": len(s.company_ids)
            }
            for s in upcoming_schedules
        ],
        "recent_schedules": [
            {
                "id": s.id,
                "name": s.name,
                "last_run_at": s.last_run_at.isoformat() if s.last_run_at else None,
                "company_count": len(s.company_ids)
            }
            for s in recent_schedules
        ]
    }