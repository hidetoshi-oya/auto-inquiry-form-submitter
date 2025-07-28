import React, { useState, useEffect } from 'react'
import { TaskStatusResponse, TaskStatus } from '../../types/models'

interface TaskStatusMonitorProps {
  taskId: string
  autoRefresh?: boolean
  refreshInterval?: number // milliseconds
  onStatusChange?: (status: TaskStatus, response: TaskStatusResponse) => void
  onComplete?: (result: any) => void
  onError?: (error: string) => void
  className?: string
}

export function TaskStatusMonitor({
  taskId,
  autoRefresh = true,
  refreshInterval = 3000,
  onStatusChange,
  onComplete,
  onError,
  className = ''
}: TaskStatusMonitorProps) {
  const [taskStatus, setTaskStatus] = useState<TaskStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTaskStatus = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/status`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: TaskStatusResponse = await response.json()
      
      // 日付文字列をDateオブジェクトに変換
      if (data.started_at) {
        data.started_at = new Date(data.started_at)
      }
      if (data.completed_at) {
        data.completed_at = new Date(data.completed_at)
      }

      setTaskStatus(data)
      setError(null)
      
      // コールバック呼び出し
      if (onStatusChange) {
        onStatusChange(data.status, data)
      }

      // 完了時のコールバック
      if (data.status === 'SUCCESS' && onComplete) {
        onComplete(data.result)
      }

      // エラー時のコールバック
      if (data.status === 'FAILURE' && onError && data.error_message) {
        onError(data.error_message)
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      if (onError) {
        onError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTaskStatus()

    if (!autoRefresh || !taskStatus) return

    // 終了状態の場合は自動更新を停止
    const finalStates: TaskStatus[] = ['SUCCESS', 'FAILURE', 'REVOKED']
    if (taskStatus && finalStates.includes(taskStatus.status)) {
      return
    }

    const interval = setInterval(() => {
      fetchTaskStatus()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [taskId, autoRefresh, refreshInterval, taskStatus?.status])

  const getStatusColor = (status: TaskStatus): string => {
    switch (status) {
      case 'SUCCESS':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'FAILURE':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'PENDING':
        return 'text-gray-600 bg-gray-50 border-gray-200'
      case 'STARTED':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'RETRY':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'REVOKED':
        return 'text-purple-600 bg-purple-50 border-purple-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'FAILURE':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case 'STARTED':
        return (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
        )
      case 'RETRY':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )
      case 'REVOKED':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
          </svg>
        )
      case 'PENDING':
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  const getStatusText = (status: TaskStatus): string => {
    switch (status) {
      case 'SUCCESS':
        return '完了'
      case 'FAILURE':
        return '失敗'
      case 'PENDING':
        return '待機中'
      case 'STARTED':
        return '実行中'
      case 'RETRY':
        return 'リトライ中'
      case 'REVOKED':
        return 'キャンセル済み'
      default:
        return status
    }
  }

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}秒`
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      return `${minutes}分${remainingSeconds.toFixed(0)}秒`
    } else {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      return `${hours}時間${minutes}分`
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 border rounded-lg bg-gray-50 ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 mr-3"></div>
        <span className="text-gray-600">タスク状態を確認中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`p-4 border rounded-lg bg-red-50 border-red-200 ${className}`}>
        <div className="flex items-center">
          <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-red-800 font-medium">エラー: {error}</span>
        </div>
      </div>
    )
  }

  if (!taskStatus) {
    return (
      <div className={`p-4 border rounded-lg bg-gray-50 border-gray-200 ${className}`}>
        <span className="text-gray-600">タスク情報が見つかりません</span>
      </div>
    )
  }

  return (
    <div className={`p-4 border rounded-lg ${getStatusColor(taskStatus.status)} ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          {getStatusIcon(taskStatus.status)}
          <div className="ml-3">
            <div className="flex items-center">
              <span className="font-medium">{getStatusText(taskStatus.status)}</span>
              {taskStatus.retries && taskStatus.retries > 0 && (
                <span className="ml-2 text-sm opacity-75">
                  (リトライ: {taskStatus.retries}/{taskStatus.max_retries})
                </span>
              )}
            </div>
            <div className="text-sm opacity-75 mt-1">
              Task ID: {taskStatus.task_id}
            </div>
          </div>
        </div>

        {taskStatus.runtime && (
          <div className="text-sm opacity-75">
            実行時間: {formatDuration(taskStatus.runtime)}
          </div>
        )}
      </div>

      {/* 進捗情報 */}
      {taskStatus.progress && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span>進捗</span>
            <span>
              {taskStatus.progress.current || 0} / {taskStatus.progress.total || 0}
            </span>
          </div>
          {taskStatus.progress.total && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-current h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, ((taskStatus.progress.current || 0) / taskStatus.progress.total) * 100)}%`
                }}
              ></div>
            </div>
          )}
          {taskStatus.progress.description && (
            <div className="text-sm opacity-75 mt-2">
              {taskStatus.progress.description}
            </div>
          )}
        </div>
      )}

      {/* エラーメッセージ */}
      {taskStatus.error_message && (
        <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded text-sm">
          <div className="font-medium text-red-800 mb-1">エラー詳細:</div>
          <div className="text-red-700">{taskStatus.error_message}</div>
        </div>
      )}

      {/* 実行結果 */}
      {taskStatus.status === 'SUCCESS' && taskStatus.result && (
        <div className="mt-4 p-3 bg-green-100 border border-green-200 rounded text-sm">
          <div className="font-medium text-green-800 mb-1">実行結果:</div>
          <pre className="text-green-700 whitespace-pre-wrap">
            {typeof taskStatus.result === 'string' 
              ? taskStatus.result 
              : JSON.stringify(taskStatus.result, null, 2)}
          </pre>
        </div>
      )}

      {/* ワーカー情報 */}
      {taskStatus.worker_name && (
        <div className="mt-3 text-xs opacity-60">
          ワーカー: {taskStatus.worker_name}
        </div>
      )}
    </div>
  )
}