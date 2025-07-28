import React, { useState, useEffect } from 'react'
import { TaskStatusResponse, TaskStatus } from '../../types/models'
import { TaskActionRequest, TaskActionResponse } from '../../types/api'
import { TaskStatusMonitor } from './TaskStatusMonitor'

interface TaskDetailModalProps {
  taskId: string
  isOpen: boolean
  onClose: () => void
  onTaskAction?: (action: string, success: boolean) => void
}

export function TaskDetailModal({
  taskId,
  isOpen,
  onClose,
  onTaskAction
}: TaskDetailModalProps) {
  const [taskDetail, setTaskDetail] = useState<TaskStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchTaskDetail = async () => {
    try {
      setLoading(true)
      setError(null)

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

      setTaskDetail(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleTaskAction = async (action: 'revoke' | 'retry', terminate: boolean = false) => {
    try {
      setActionLoading(action)

      const requestBody: TaskActionRequest = {
        action,
        terminate,
        signal: 'SIGTERM'
      }

      const response = await fetch(`/api/tasks/${taskId}/action`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: TaskActionResponse = await response.json()
      
      if (onTaskAction) {
        onTaskAction(action, result.success)
      }

      // アクション成功時はタスク詳細を再取得
      if (result.success) {
        setTimeout(() => {
          fetchTaskDetail()
        }, 1000)
      }

      alert(result.message)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      alert(`アクション実行エラー: ${errorMessage}`)
    } finally {
      setActionLoading(null)
    }
  }

  useEffect(() => {
    if (isOpen && taskId) {
      fetchTaskDetail()
    }
  }, [isOpen, taskId])

  if (!isOpen) return null

  const formatDate = (date: Date | undefined): string => {
    if (!date) return '-'
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    }).format(date)
  }

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds.toFixed(2)}秒`
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = (seconds % 60).toFixed(0)
      return `${minutes}分${remainingSeconds}秒`
    } else {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      return `${hours}時間${minutes}分`
    }
  }

  const canRevoke = taskDetail && !['SUCCESS', 'FAILURE', 'REVOKED'].includes(taskDetail.status)
  const canRetry = taskDetail && ['FAILURE', 'REVOKED'].includes(taskDetail.status)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            タスク詳細: {taskId.substring(0, 8)}...
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-gray-600">タスク詳細を読み込み中...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600 mb-2">エラーが発生しました</div>
              <div className="text-gray-600 text-sm mb-4">{error}</div>
              <button
                onClick={fetchTaskDetail}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                再試行
              </button>
            </div>
          ) : taskDetail ? (
            <div className="space-y-6">
              {/* タスク状態監視 */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">リアルタイム状態</h3>
                <TaskStatusMonitor 
                  taskId={taskId}
                  autoRefresh={true}
                  refreshInterval={2000}
                  onStatusChange={(status, response) => {
                    setTaskDetail(response)
                  }}
                />
              </div>

              {/* 基本情報 */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">基本情報</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-500">タスクID</div>
                      <div className="text-sm text-gray-900 font-mono break-all">{taskDetail.task_id}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">ワーカー</div>
                      <div className="text-sm text-gray-900">{taskDetail.worker_name || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">開始時刻</div>
                      <div className="text-sm text-gray-900">{formatDate(taskDetail.started_at)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">完了時刻</div>
                      <div className="text-sm text-gray-900">{formatDate(taskDetail.completed_at)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">実行時間</div>
                      <div className="text-sm text-gray-900">
                        {taskDetail.runtime ? formatDuration(taskDetail.runtime) : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">リトライ</div>
                      <div className="text-sm text-gray-900">
                        {taskDetail.retries !== undefined ? `${taskDetail.retries}/${taskDetail.max_retries}` : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 実行結果 */}
              {taskDetail.result && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">実行結果</h3>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <pre className="text-sm text-green-800 whitespace-pre-wrap overflow-x-auto">
                      {typeof taskDetail.result === 'string' 
                        ? taskDetail.result 
                        : JSON.stringify(taskDetail.result, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* エラー詳細 */}
              {(taskDetail.error_message || taskDetail.traceback) && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">エラー詳細</h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                    {taskDetail.error_message && (
                      <div>
                        <div className="text-sm font-medium text-red-800 mb-1">エラーメッセージ:</div>
                        <div className="text-sm text-red-700">{taskDetail.error_message}</div>
                      </div>
                    )}
                    {taskDetail.traceback && (
                      <div>
                        <div className="text-sm font-medium text-red-800 mb-1">スタックトレース:</div>
                        <pre className="text-xs text-red-700 whitespace-pre-wrap overflow-x-auto">
                          {taskDetail.traceback}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* アクションボタン */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">アクション</h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(taskDetail.task_id)
                      alert('タスクIDをクリップボードにコピーしました')
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    IDをコピー
                  </button>

                  <button
                    onClick={fetchTaskDetail}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    更新
                  </button>

                  {canRevoke && (
                    <button
                      onClick={() => handleTaskAction('revoke', false)}
                      disabled={actionLoading === 'revoke'}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === 'revoke' ? 'キャンセル中...' : 'キャンセル'}
                    </button>
                  )}

                  {canRevoke && (
                    <button
                      onClick={() => {
                        if (confirm('タスクを強制終了しますか？この操作は元に戻せません。')) {
                          handleTaskAction('revoke', true)
                        }
                      }}
                      disabled={actionLoading === 'revoke'}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === 'revoke' ? '強制終了中...' : '強制終了'}
                    </button>
                  )}

                  {canRetry && (
                    <button
                      onClick={() => {
                        if (confirm('タスクを再実行しますか？')) {
                          handleTaskAction('retry')
                        }
                      }}
                      disabled={actionLoading === 'retry'}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === 'retry' ? '再実行中...' : '再実行'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-600">タスク詳細が見つかりません</div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}