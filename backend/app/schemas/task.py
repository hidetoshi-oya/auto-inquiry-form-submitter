"""
Celeryタスク状態管理用のPydanticスキーマ
"""
from datetime import datetime
from typing import Optional, Any, Dict, List
from enum import Enum

from pydantic import BaseModel


class TaskStatus(str, Enum):
    """Celeryタスクの状態"""
    PENDING = "PENDING"      # 待機中または不明
    STARTED = "STARTED"      # 実行開始
    SUCCESS = "SUCCESS"      # 成功
    FAILURE = "FAILURE"      # 失敗
    RETRY = "RETRY"          # リトライ中
    REVOKED = "REVOKED"      # 取り消し


class TaskInfo(BaseModel):
    """タスク基本情報"""
    task_id: str
    task_name: str
    status: TaskStatus
    result: Optional[Any] = None
    traceback: Optional[str] = None
    date_created: Optional[datetime] = None
    date_started: Optional[datetime] = None
    date_done: Optional[datetime] = None
    worker: Optional[str] = None
    retries: Optional[int] = None
    eta: Optional[datetime] = None
    expires: Optional[datetime] = None
    args: Optional[List[Any]] = None
    kwargs: Optional[Dict[str, Any]] = None


class TaskStatusResponse(BaseModel):
    """タスク状態レスポンス"""
    task_id: str
    status: TaskStatus
    result: Optional[Any] = None
    traceback: Optional[str] = None
    progress: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    runtime: Optional[float] = None  # 実行時間（秒）
    worker_name: Optional[str] = None
    retries: Optional[int] = None
    max_retries: Optional[int] = None


class TaskListResponse(BaseModel):
    """タスク一覧レスポンス"""
    tasks: List[TaskInfo]
    total: int
    page: int
    per_page: int


class TaskListFilter(BaseModel):
    """タスク一覧フィルター"""
    status: Optional[TaskStatus] = None
    task_name: Optional[str] = None
    worker: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    page: int = 1
    per_page: int = 50


class TaskActionRequest(BaseModel):
    """タスクアクション要求"""
    action: str  # "revoke", "retry", etc.
    terminate: bool = False  # タスクを強制終了するか
    signal: str = "SIGTERM"  # 送信するシグナル


class TaskActionResponse(BaseModel):
    """タスクアクション結果"""
    task_id: str
    action: str
    success: bool
    message: str
    timestamp: datetime


class TaskProgressUpdate(BaseModel):
    """タスク進捗更新"""
    task_id: str
    current: int
    total: int
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class TaskMetrics(BaseModel):
    """タスク統計情報"""
    total_tasks: int
    pending_tasks: int
    running_tasks: int
    successful_tasks: int
    failed_tasks: int
    retry_tasks: int
    average_runtime: Optional[float] = None
    tasks_per_hour: Optional[float] = None