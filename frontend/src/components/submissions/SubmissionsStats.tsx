import { useMemo } from 'react'
import { Submission } from '../../types/models'

interface SubmissionsStatsProps {
  submissions: Submission[]
  total: number
  loading?: boolean
}

interface Stats {
  total: number
  success: number
  failed: number
  pending: number
  captchaRequired: number
  successRate: number
  totalToday: number
  successToday: number
}

export function SubmissionsStats({
  submissions,
  total,
  loading = false
}: SubmissionsStatsProps) {
  
  const stats = useMemo((): Stats => {
    if (loading || submissions.length === 0) {
      return {
        total: 0,
        success: 0,
        failed: 0,
        pending: 0,
        captchaRequired: 0,
        successRate: 0,
        totalToday: 0,
        successToday: 0
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const success = submissions.filter(s => s.status === 'success').length
    const failed = submissions.filter(s => s.status === 'failed').length
    const pending = submissions.filter(s => s.status === 'pending').length
    const captchaRequired = submissions.filter(s => s.status === 'captcha_required').length

    const todaySubmissions = submissions.filter(s => {
      const submissionDate = new Date(s.submittedAt)
      submissionDate.setHours(0, 0, 0, 0)
      return submissionDate.getTime() === today.getTime()
    })

    const successToday = todaySubmissions.filter(s => s.status === 'success').length

    return {
      total,
      success,
      failed,
      pending,
      captchaRequired,
      successRate: total > 0 ? (success / total) * 100 : 0,
      totalToday: todaySubmissions.length,
      successToday
    }
  }, [submissions, total, loading])

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const statCards = [
    {
      title: '総送信数',
      value: stats.total.toLocaleString(),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: '送信成功',
      value: stats.success.toLocaleString(),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: '送信失敗',
      value: stats.failed.toLocaleString(),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: '送信中',
      value: stats.pending.toLocaleString(),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      title: '成功率',
      value: `${stats.successRate.toFixed(1)}%`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: stats.successRate >= 80 ? 'text-green-600' : stats.successRate >= 60 ? 'text-yellow-600' : 'text-red-600',
      bgColor: stats.successRate >= 80 ? 'bg-green-50' : stats.successRate >= 60 ? 'bg-yellow-50' : 'bg-red-50'
    },
    {
      title: '今日の送信',
      value: `${stats.successToday}/${stats.totalToday}`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {statCards.map((stat, index) => (
        <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className={`${stat.bgColor} rounded-lg p-2`}>
              <div className={stat.color}>
                {stat.icon}
              </div>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {stat.title}
              </p>
              <p className={`text-lg font-semibold ${stat.color}`}>
                {stat.value}
              </p>
            </div>
          </div>
        </div>
      ))}
      
      {/* CAPTCHA必要の件数（値がある場合のみ表示） */}
      {stats.captchaRequired > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow md:col-span-3 lg:col-span-6">
          <div className="flex items-center">
            <div className="bg-orange-50 rounded-lg p-2">
              <div className="text-orange-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900">
                CAPTCHA認証が必要な送信が {stats.captchaRequired} 件あります
              </p>
              <p className="text-xs text-gray-500 mt-1">
                手動での確認が必要です
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 