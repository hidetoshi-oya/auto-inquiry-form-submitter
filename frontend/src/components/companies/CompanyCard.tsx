import { Company } from '../../types/models'

interface CompanyCardProps {
  company: Company
  onEdit: (company: Company) => void
  onDelete: (companyId: number) => void
}

export function CompanyCard({ company, onEdit, onDelete }: CompanyCardProps) {
  const statusConfig = {
    active: {
      label: 'アクティブ',
      className: 'bg-green-100 text-green-800'
    },
    inactive: {
      label: '非アクティブ',
      className: 'bg-gray-100 text-gray-800'
    },
    blocked: {
      label: 'ブロック済み',
      className: 'bg-red-100 text-red-800'
    }
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* ヘッダー */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
            {company.name}
          </h3>
          <a
            href={company.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm break-all"
          >
            {company.url}
          </a>
        </div>
        
        {/* ステータスバッジ */}
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[company.status].className}`}>
          {statusConfig[company.status].label}
        </span>
      </div>

      {/* メモ */}
      {company.memo && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {company.memo}
        </p>
      )}

      {/* 詳細情報 */}
      <div className="space-y-2 text-xs text-gray-500 mb-4">
        <div className="flex justify-between">
          <span>作成日時:</span>
          <span>{formatDate(company.createdAt)}</span>
        </div>
        
        {company.lastSubmittedAt && (
          <div className="flex justify-between">
            <span>最終送信:</span>
            <span>{formatDate(company.lastSubmittedAt)}</span>
          </div>
        )}
      </div>

      {/* アクションボタン */}
      <div className="flex justify-end space-x-2 pt-4 border-t border-gray-100">
        <button
          onClick={() => onEdit(company)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium 
                     px-3 py-1 rounded hover:bg-blue-50 transition-colors"
        >
          編集
        </button>
        
        <button
          onClick={() => onDelete(company.id)}
          className="text-red-600 hover:text-red-800 text-sm font-medium 
                     px-3 py-1 rounded hover:bg-red-50 transition-colors"
        >
          削除
        </button>
      </div>
    </div>
  )
} 