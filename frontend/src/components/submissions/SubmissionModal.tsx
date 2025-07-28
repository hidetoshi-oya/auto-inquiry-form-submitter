import { Fragment } from 'react'
import { Submission, Company, Template } from '../../types/models'

interface SubmissionModalProps {
  isOpen: boolean
  submission?: Submission
  company?: Company
  template?: Template
  onClose: () => void
}

export function SubmissionModal({
  isOpen,
  submission,
  company,
  template,
  onClose
}: SubmissionModalProps) {
  if (!isOpen || !submission) return null

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'success':
        return {
          label: '送信成功',
          className: 'bg-green-100 text-green-800',
          dotColor: 'bg-green-500',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )
        }
      case 'failed':
        return {
          label: '送信失敗',
          className: 'bg-red-100 text-red-800',
          dotColor: 'bg-red-500',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )
        }
      case 'pending':
        return {
          label: '送信中',
          className: 'bg-yellow-100 text-yellow-800',
          dotColor: 'bg-yellow-500',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        }
      case 'captcha_required':
        return {
          label: 'CAPTCHA必要',
          className: 'bg-orange-100 text-orange-800',
          dotColor: 'bg-orange-500',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          )
        }
      default:
        return {
          label: '不明',
          className: 'bg-gray-100 text-gray-800',
          dotColor: 'bg-gray-500',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        }
    }
  }

  const statusConfig = getStatusConfig(submission.status)

  return (
    <Fragment>
      {/* バックドロップ */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* モーダル */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* ヘッダー */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">送信詳細</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* コンテンツ */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 基本情報 */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 uppercase tracking-wide">基本情報</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">送信日時</label>
                    <p className="text-sm text-gray-900">
                      {new Date(submission.submittedAt).toLocaleString('ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">企業名</label>
                    <p className="text-sm text-gray-900">{company?.name || '不明'}</p>
                    {company?.url && (
                      <a 
                        href={company.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block"
                      >
                        {company.url}
                      </a>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">テンプレート</label>
                    <p className="text-sm text-gray-900">{template?.name || '不明'}</p>
                    {template?.category && (
                      <span className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded mt-1">
                        {template.category}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.className}`}>
                      {statusConfig.icon}
                      <span className="ml-2">{statusConfig.label}</span>
                    </div>
                  </div>
                </div>

                {/* 送信データ */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 uppercase tracking-wide">送信データ</h4>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    {Object.entries(submission.submittedData).map(([key, value]) => (
                      <div key={key} className="mb-3 last:mb-0">
                        <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">
                          {key}
                        </label>
                        <p className="text-sm text-gray-900 break-words">
                          {typeof value === 'string' ? value : JSON.stringify(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* レスポンス・エラー情報 */}
              <div className="mt-6 space-y-4">
                {submission.response && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 uppercase tracking-wide mb-2">レスポンス</h4>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-800">{submission.response}</p>
                    </div>
                  </div>
                )}

                {submission.errorMessage && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 uppercase tracking-wide mb-2">エラー</h4>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm text-red-800">{submission.errorMessage}</p>
                    </div>
                  </div>
                )}

                {submission.screenshotUrl && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 uppercase tracking-wide mb-2">スクリーンショット</h4>
                    <div className="border border-gray-200 rounded-lg p-4">
                      <a
                        href={submission.screenshotUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        スクリーンショットを表示
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* フッター */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={onClose}
                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 
                           font-medium py-2 px-4 rounded-lg shadow-sm transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  )
} 