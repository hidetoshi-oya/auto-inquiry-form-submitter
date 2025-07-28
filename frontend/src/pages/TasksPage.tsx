import { useState, useEffect } from 'react'
import { TaskStatusMonitor } from '../components/tasks/TaskStatusMonitor'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { EmptyState } from '../components/ui/EmptyState'
import { Pagination } from '../components/ui/Pagination'
import { TaskInfo, TaskListResponse, TaskStatus, TaskMetrics } from '../types/models'

interface TasksState {
  tasks: TaskInfo[]
  total: number
  page: number
  loading: boolean
  error: string | null
}

interface TaskFilters {
  status: TaskStatus | 'all'
  task_name: string
}

interface TasksPageProps {}

export function TasksPage({}: TasksPageProps) {
  const [state, setState] = useState<TasksState>({
    tasks: [],
    total: 0,
    page: 1,
    loading: true,
    error: null
  })

  const [filters, setFilters] = useState<TaskFilters>({
    status: 'all',
    task_name: ''
  })

  const [metrics, setMetrics] = useState<TaskMetrics | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const perPage = 20

  // タスクデータの取得
  const fetchTasks = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))

      const params = new URLSearchParams({
        page: state.page.toString(),
        per_page: perPage.toString(),
      })

      if (filters.status !== 'all') {
        params.append('status', filters.status)
      }
      if (filters.task_name.trim()) {
        params.append('task_name', filters.task_name.trim())
      }

      const response = await fetch(`/api/tasks?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: TaskListResponse = await response.json()

      // 日付文字列をDateオブジェクトに変換
      const tasks = data.tasks.map(task => ({
        ...task,
        date_created: task.date_created ? new Date(task.date_created) : undefined,
        date_started: task.date_started ? new Date(task.date_started) : undefined,
        date_done: task.date_done ? new Date(task.date_done) : undefined,
        eta: task.eta ? new Date(task.eta) : undefined,
        expires: task.expires ? new Date(task.expires) : undefined,
      }))

      setState(prev => ({
        ...prev,
        tasks,
        total: data.total,
        loading: false
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
    }
  }

  // メトリクスデータの取得
  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/tasks/metrics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data: TaskMetrics = await response.json()
        setMetrics(data)
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
    }
  }

  useEffect(() => {
    fetchTasks()
    fetchMetrics()
  }, [state.page, filters])

  // 自動更新
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchTasks()
      fetchMetrics()
    }, 5000) // 5秒間隔

    return () => clearInterval(interval)
  }, [autoRefresh, state.page, filters])

  const handlePageChange = (newPage: number) => {
    setState(prev => ({ ...prev, page: newPage }))
  }

  const handleFilterChange = (newFilters: Partial<TaskFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setState(prev => ({ ...prev, page: 1 })) // ページをリセット
  }

  const getStatusColor = (status: TaskStatus): string => {
    switch (status) {
      case 'SUCCESS':
        return 'text-green-600 bg-green-100'
      case 'FAILURE':
        return 'text-red-600 bg-red-100'
      case 'PENDING':
        return 'text-gray-600 bg-gray-100'
      case 'STARTED':
        return 'text-blue-600 bg-blue-100'
      case 'RETRY':
        return 'text-yellow-600 bg-yellow-100'
      case 'REVOKED':
        return 'text-purple-600 bg-purple-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const formatTaskName = (taskName: string): string => {
    return taskName.replace(/^app\.tasks\./, '').replace(/^.*\./, '')
  }

  const formatDate = (date: Date | undefined): string => {
    if (!date) return '-'
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">タスク管理</h1>
          <p className="text-gray-600 mt-2">Celeryタスクの状態を監視・管理できます</p>
        </div>

        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            />
            <span className="ml-2 text-sm text-gray-700">自動更新</span>
          </label>

          <button
            onClick={() => {
              fetchTasks()
              fetchMetrics()
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            更新
          </button>
        </div>
      </div>

      {/* メトリクス表示 */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{metrics.total_tasks}</div>
            <div className="text-sm text-gray-600">総タスク数</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-blue-600">{metrics.running_tasks}</div>
            <div className="text-sm text-gray-600">実行中</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-yellow-600">{metrics.pending_tasks}</div>
            <div className="text-sm text-gray-600">待機中</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-green-600">{metrics.successful_tasks}</div>
            <div className="text-sm text-gray-600">成功</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-red-600">{metrics.failed_tasks}</div>
            <div className="text-sm text-gray-600">失敗</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-purple-600">{metrics.retry_tasks}</div>
            <div className="text-sm text-gray-600">リトライ</div>
          </div>
        </div>
      )}

      {/* フィルター */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              状態フィルター
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange({ status: e.target.value as TaskStatus | 'all' })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            >
              <option value="all">すべて</option>
              <option value="PENDING">待機中</option>
              <option value="STARTED">実行中</option>
              <option value="SUCCESS">成功</option>
              <option value="FAILURE">失敗</option>
              <option value="RETRY">リトライ中</option>
              <option value="REVOKED">キャンセル済み</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              タスク名検索
            </label>
            <input
              type="text"
              value={filters.task_name}
              onChange={(e) => handleFilterChange({ task_name: e.target.value })}
              placeholder="タスク名で検索..."
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({ status: 'all', task_name: '' })
                setState(prev => ({ ...prev, page: 1 }))
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              クリア
            </button>
          </div>
        </div>
      </div>

      {/* 選択されたタスクの詳細監視 */}
      {selectedTaskId && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium text-gray-900">
              タスク詳細監視: {selectedTaskId}
            </h3>
            <button
              onClick={() => setSelectedTaskId(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <TaskStatusMonitor 
            taskId={selectedTaskId}
            autoRefresh={autoRefresh}
            refreshInterval={3000}
          />
        </div>
      )}

      {/* タスク一覧 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {state.loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
            <span className="ml-2 text-gray-600">タスク一覧を読み込み中...</span>
          </div>
        ) : state.error ? (
          <div className="p-6 text-center">
            <div className="text-red-600 mb-2">エラーが発生しました</div>
            <div className="text-gray-600 text-sm">{state.error}</div>
            <button
              onClick={() => fetchTasks()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              再試行
            </button>
          </div>
        ) : state.tasks.length === 0 ? (
          <EmptyState
            title="タスクが見つかりません"
            description="現在実行中または待機中のタスクはありません。"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    タスクID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    タスク名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状態
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ワーカー
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    開始時刻
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {state.tasks.map((task) => (
                  <tr key={task.task_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900">
                        {task.task_id.substring(0, 8)}...
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatTaskName(task.task_name)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                      {task.retries && task.retries > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          リトライ: {task.retries}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {task.worker || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(task.date_started)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedTaskId(task.task_id)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        監視
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(task.task_id)
                        }}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        ID をコピー
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ページネーション */}
        {state.total > perPage && (
          <div className="bg-white px-4 py-3 border-t border-gray-200">
            <Pagination
              currentPage={state.page}
              totalPages={Math.ceil(state.total / perPage)}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>
    </div>
  )
}