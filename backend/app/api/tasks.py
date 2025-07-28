"""
Celeryタスク状態管理用のAPIエンドポイント
"""
from typing import Any, List, Optional
from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from celery.result import AsyncResult
from celery import states
from sqlalchemy.orm import Session

from app.api import deps
from app.core.celery_app import celery_app
from app.core.database import get_db
from app.models.user import User
from app.schemas.task import (
    TaskInfo, TaskStatusResponse, TaskListResponse, TaskListFilter,
    TaskActionRequest, TaskActionResponse, TaskMetrics, TaskStatus
)

logger = logging.getLogger(__name__)
router = APIRouter()


def get_task_info_from_result(task_id: str, result: AsyncResult) -> TaskInfo:
    """AsyncResultからTaskInfoオブジェクトを生成"""
    try:
        # タスクの基本情報を取得
        task_info = result.info or {}
        
        # タスク状態をTaskStatusに変換
        status = TaskStatus(result.state) if result.state in TaskStatus.__members__ else TaskStatus.PENDING
        
        # 結果の処理
        task_result = None
        if result.successful():
            task_result = result.result
        elif result.failed():
            task_result = str(result.result) if result.result else None
            
        # 日付情報の処理
        date_created = None
        date_started = None
        date_done = None
        
        # メタデータから日付情報を取得（利用可能な場合）
        if isinstance(task_info, dict):
            if 'date_created' in task_info:
                date_created = task_info['date_created']
            if 'date_started' in task_info:
                date_started = task_info['date_started']
            if 'date_done' in task_info:
                date_done = task_info['date_done']
        
        return TaskInfo(
            task_id=task_id,
            task_name=result.name or "unknown",
            status=status,
            result=task_result,
            traceback=result.traceback if result.failed() else None,
            date_created=date_created,
            date_started=date_started,
            date_done=date_done,
            worker=task_info.get('hostname') if isinstance(task_info, dict) else None,
            retries=task_info.get('retries') if isinstance(task_info, dict) else None,
            args=task_info.get('args') if isinstance(task_info, dict) else None,
            kwargs=task_info.get('kwargs') if isinstance(task_info, dict) else None,
        )
    except Exception as e:
        logger.error(f"タスク情報取得エラー {task_id}: {e}")
        return TaskInfo(
            task_id=task_id,
            task_name="unknown",
            status=TaskStatus.PENDING,
            result=None
        )


@router.get("/{task_id}/status", response_model=TaskStatusResponse)
def get_task_status(
    *,
    task_id: str,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """特定タスクの状態を取得"""
    try:
        # AsyncResultを取得
        result = AsyncResult(task_id, app=celery_app)
        
        # タスク状態をTaskStatusに変換
        status = TaskStatus(result.state) if result.state in TaskStatus.__members__ else TaskStatus.PENDING
        
        # 進捗情報の取得
        progress = None
        error_message = None
        runtime = None
        
        if result.info and isinstance(result.info, dict):
            progress = result.info.get('progress')
            if result.failed() and 'error' in result.info:
                error_message = result.info['error']
            runtime = result.info.get('runtime')
        
        # エラーメッセージの処理
        if result.failed() and not error_message:
            error_message = str(result.result) if result.result else "Unknown error"
        
        # 実行時間の計算
        started_at = None
        completed_at = None
        if result.date_done:
            completed_at = result.date_done
            if hasattr(result, 'date_started') and result.date_started:
                started_at = result.date_started
                runtime = (completed_at - started_at).total_seconds()
        
        return TaskStatusResponse(
            task_id=task_id,
            status=status,
            result=result.result if result.successful() else None,
            traceback=result.traceback if result.failed() else None,
            progress=progress,
            error_message=error_message,
            started_at=started_at,
            completed_at=completed_at,
            runtime=runtime,
            worker_name=result.info.get('hostname') if result.info and isinstance(result.info, dict) else None,
            retries=result.info.get('retries') if result.info and isinstance(result.info, dict) else None,
            max_retries=3  # デフォルト値、設定から取得する場合は別途実装
        )
        
    except Exception as e:
        logger.error(f"タスク状態取得エラー {task_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get task status: {str(e)}")


@router.get("", response_model=TaskListResponse)
def list_tasks(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    status: Optional[TaskStatus] = Query(None, description="フィルタ: タスク状態"),
    task_name: Optional[str] = Query(None, description="フィルタ: タスク名"),
    page: int = Query(1, ge=1, description="ページ番号"),
    per_page: int = Query(50, ge=1, le=100, description="1ページあたりの件数"),
) -> Any:
    """アクティブなタスク一覧を取得"""
    try:
        # Celeryのインスペクション機能を使用してアクティブなタスクを取得
        inspect = celery_app.control.inspect()
        
        # アクティブ、予約済み、スケジュール済みタスクを取得
        active_tasks = inspect.active() or {}
        reserved_tasks = inspect.reserved() or {}
        scheduled_tasks = inspect.scheduled() or {}
        
        all_tasks = []
        
        # 各ワーカーからタスクを収集
        for worker_name, tasks in active_tasks.items():
            for task_data in tasks:
                task_id = task_data.get('id', 'unknown')
                result = AsyncResult(task_id, app=celery_app)
                task_info = get_task_info_from_result(task_id, result)
                task_info.worker = worker_name
                all_tasks.append(task_info)
        
        for worker_name, tasks in reserved_tasks.items():
            for task_data in tasks:
                task_id = task_data.get('id', 'unknown')
                result = AsyncResult(task_id, app=celery_app)
                task_info = get_task_info_from_result(task_id, result)
                task_info.worker = worker_name
                all_tasks.append(task_info)
                
        for worker_name, tasks in scheduled_tasks.items():
            for task_data in tasks:
                task_id = task_data.get('id', 'unknown')
                result = AsyncResult(task_id, app=celery_app)
                task_info = get_task_info_from_result(task_id, result)
                task_info.worker = worker_name
                task_info.eta = datetime.fromtimestamp(task_data.get('eta', 0), tz=timezone.utc)
                all_tasks.append(task_info)
        
        # フィルタリング
        filtered_tasks = all_tasks
        if status:
            filtered_tasks = [t for t in filtered_tasks if t.status == status]
        if task_name:
            filtered_tasks = [t for t in filtered_tasks if task_name.lower() in t.task_name.lower()]
        
        # ページネーション
        total = len(filtered_tasks)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_tasks = filtered_tasks[start:end]
        
        return TaskListResponse(
            tasks=paginated_tasks,
            total=total,
            page=page,
            per_page=per_page
        )
        
    except Exception as e:
        logger.error(f"タスク一覧取得エラー: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list tasks: {str(e)}")


@router.post("/{task_id}/action", response_model=TaskActionResponse)
def task_action(
    *,
    task_id: str,
    action_request: TaskActionRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """タスクに対するアクション実行（取り消し、再実行など）"""
    try:
        result = AsyncResult(task_id, app=celery_app)
        
        if action_request.action == "revoke":
            # タスクの取り消し
            celery_app.control.revoke(
                task_id, 
                terminate=action_request.terminate,
                signal=action_request.signal
            )
            return TaskActionResponse(
                task_id=task_id,
                action="revoke",
                success=True,
                message=f"Task {task_id} has been revoked",
                timestamp=datetime.now(timezone.utc)
            )
        
        elif action_request.action == "retry":
            # タスクの再実行
            # 注意: これは新しいタスクIDで実行されます
            if result.name:
                # 元のタスクの引数を取得して再実行
                task_func = celery_app.tasks.get(result.name)
                if task_func:
                    args = result.args or []
                    kwargs = result.kwargs or {}
                    new_result = task_func.apply_async(args=args, kwargs=kwargs)
                    return TaskActionResponse(
                        task_id=new_result.id,  # 新しいタスクID
                        action="retry",
                        success=True,
                        message=f"Task {result.name} has been retried with new ID: {new_result.id}",
                        timestamp=datetime.now(timezone.utc)
                    )
            
            raise HTTPException(status_code=400, detail="Cannot retry task: task name not found")
        
        else:
            raise HTTPException(status_code=400, detail=f"Unknown action: {action_request.action}")
            
    except Exception as e:
        logger.error(f"タスクアクション実行エラー {task_id}: {e}")
        return TaskActionResponse(
            task_id=task_id,
            action=action_request.action,
            success=False,
            message=f"Action failed: {str(e)}",
            timestamp=datetime.now(timezone.utc)
        )


@router.get("/metrics", response_model=TaskMetrics)
def get_task_metrics(
    *,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """タスクの統計情報を取得"""
    try:
        inspect = celery_app.control.inspect()
        
        # 各種タスク情報を取得
        active_tasks = inspect.active() or {}
        reserved_tasks = inspect.reserved() or {}
        stats = inspect.stats() or {}
        
        # メトリクスを計算
        total_active = sum(len(tasks) for tasks in active_tasks.values())
        total_reserved = sum(len(tasks) for tasks in reserved_tasks.values())
        
        # ワーカー統計から情報を取得
        total_processed = 0
        for worker_stats in stats.values():
            if 'total' in worker_stats:
                total_processed += worker_stats['total']
        
        return TaskMetrics(
            total_tasks=total_processed,
            pending_tasks=total_reserved,
            running_tasks=total_active,
            successful_tasks=0,  # 詳細な統計は別途実装が必要
            failed_tasks=0,      # 詳細な統計は別途実装が必要
            retry_tasks=0,       # 詳細な統計は別途実装が必要
            average_runtime=None,  # 詳細な統計は別途実装が必要
            tasks_per_hour=None    # 詳細な統計は別途実装が必要
        )
        
    except Exception as e:
        logger.error(f"タスクメトリクス取得エラー: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get task metrics: {str(e)}")


@router.delete("/{task_id}")
def delete_task_result(
    *,
    task_id: str,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """タスク結果を削除（結果バックエンドから）"""
    try:
        result = AsyncResult(task_id, app=celery_app)
        
        # 結果を削除
        result.forget()
        
        return {
            "message": f"Task result {task_id} has been deleted",
            "task_id": task_id,
            "timestamp": datetime.now(timezone.utc)
        }
        
    except Exception as e:
        logger.error(f"タスク結果削除エラー {task_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete task result: {str(e)}")