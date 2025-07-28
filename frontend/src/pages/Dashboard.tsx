import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Building, 
  CheckCircle, 
  Zap, 
  Clock, 
  Plus, 
  Clipboard, 
  Calendar,
  Check,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardStats {
  totalCompanies: number
  totalSubmissions: number
  successRate: number
  pendingTasks: number
  recentActivity: Array<{
    id: string
    type: 'submission' | 'detection' | 'schedule'
    message: string
    timestamp: string
    status: 'success' | 'failed' | 'pending'
  }>
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCompanies: 0,
    totalSubmissions: 0,
    successRate: 0,
    pendingTasks: 0,
    recentActivity: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: 実際のAPIからダッシュボード統計を取得
    const fetchDashboardStats = async () => {
      try {
        // 仮のデータ
        setStats({
          totalCompanies: 125,
          totalSubmissions: 847,
          successRate: 87.5,
          pendingTasks: 3,
          recentActivity: [
            {
              id: '1',
              type: 'submission',
              message: '株式会社Example へのフォーム送信が完了しました',
              timestamp: '2025-01-25T10:30:00Z',
              status: 'success'
            },
            {
              id: '2',
              type: 'detection',
              message: 'ABC商事のフォーム検出を開始しました',
              timestamp: '2025-01-25T10:25:00Z',
              status: 'pending'
            },
            {
              id: '3',
              type: 'schedule',
              message: '週次送信スケジュールを実行しました',
              timestamp: '2025-01-25T09:00:00Z',
              status: 'success'
            }
          ]
        })
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardStats()
  }, [])

  if (loading) {
    return <LoadingSpinner message="ダッシュボードを読み込み中..." />
  }

  const StatCard = ({ 
    title, 
    value, 
    icon: IconComponent, 
    iconColor,
    iconBgColor 
  }: { 
    title: string; 
    value: string | number; 
    icon: React.ComponentType<{className?: string}>;
    iconColor: string;
    iconBgColor: string;
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center space-x-4">
          <div className={cn(
            "p-3 rounded-lg",
            iconBgColor
          )}>
            <IconComponent className={cn("h-6 w-6", iconColor)} />
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {title}
            </p>
            <p className="text-2xl font-bold text-foreground">
              {value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-8 p-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          ダッシュボード
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          システムの状況をご確認ください
        </p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="登録企業数"
          value={stats.totalCompanies}
          icon={Building}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-50"
        />
        <StatCard
          title="総送信数"
          value={stats.totalSubmissions}
          icon={CheckCircle}
          iconColor="text-green-600"
          iconBgColor="bg-green-50"
        />
        <StatCard
          title="成功率"
          value={`${stats.successRate}%`}
          icon={Zap}
          iconColor="text-yellow-600"
          iconBgColor="bg-yellow-50"
        />
        <StatCard
          title="待機中タスク"
          value={stats.pendingTasks}
          icon={Clock}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-50"
        />
      </div>

      {/* クイックアクション */}
      <Card>
        <CardHeader>
          <CardTitle>クイックアクション</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/companies" className="block">
              <div className="p-4 border border-border rounded-lg hover:bg-accent transition-colors cursor-pointer">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Plus className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">企業を追加</p>
                    <p className="text-sm text-muted-foreground">新しい企業を登録</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link to="/forms" className="block">
              <div className="p-4 border border-border rounded-lg hover:bg-accent transition-colors cursor-pointer">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <Clipboard className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">フォーム検出</p>
                    <p className="text-sm text-muted-foreground">問い合わせフォームを検出</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link to="/schedules" className="block">
              <div className="p-4 border border-border rounded-lg hover:bg-accent transition-colors cursor-pointer">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Calendar className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">スケジュール設定</p>
                    <p className="text-sm text-muted-foreground">自動送信スケジュール</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 最近のアクティビティ */}
      <Card>
        <CardHeader>
          <CardTitle>最近のアクティビティ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.recentActivity.map((activity) => {
              const getStatusConfig = (status: string) => {
                switch (status) {
                  case 'success':
                    return {
                      bgColor: 'bg-green-50',
                      iconColor: 'text-green-600',
                      icon: Check
                    }
                  case 'failed':
                    return {
                      bgColor: 'bg-red-50',
                      iconColor: 'text-red-600',
                      icon: X
                    }
                  default:
                    return {
                      bgColor: 'bg-yellow-50',
                      iconColor: 'text-yellow-600',
                      icon: Clock
                    }
                }
              }

              const statusConfig = getStatusConfig(activity.status)
              const IconComponent = statusConfig.icon

              return (
                <div
                  key={activity.id}
                  className="p-4 border border-border rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center space-x-4">
                    <div className={cn(
                      "p-2 rounded-full flex-shrink-0",
                      statusConfig.bgColor
                    )}>
                      <IconComponent className={cn("h-4 w-4", statusConfig.iconColor)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {activity.message}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleString('ja-JP')}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 