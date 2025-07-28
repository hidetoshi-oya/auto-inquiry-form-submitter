import { Company, Template } from '../../types/models'

interface SubmissionFilters {
  status: string
  companyId: number | string
  templateId: string
  dateFrom: string
  dateTo: string
  search: string
}

interface SubmissionsFilterProps {
  filters: SubmissionFilters
  companies: Company[]
  templates: Template[]
  onFilterChange: (filters: Partial<SubmissionFilters>) => void
  loading?: boolean
}

export function SubmissionsFilter({
  filters,
  companies,
  templates,
  onFilterChange,
  loading = false
}: SubmissionsFilterProps) {
  
  const statusOptions = [
    { value: 'all', label: 'すべて' },
    { value: 'success', label: '送信成功' },
    { value: 'failed', label: '送信失敗' },
    { value: 'pending', label: '送信中' },
    { value: 'captcha_required', label: 'CAPTCHA必要' }
  ]

  const handleClearFilters = () => {
    onFilterChange({
      status: 'all',
      companyId: '',
      templateId: '',
      dateFrom: '',
      dateTo: '',
      search: ''
    })
  }

  const hasActiveFilters = 
    filters.status !== 'all' ||
    filters.companyId ||
    filters.templateId ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.search

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* 検索 */}
        <div className="flex-1 min-w-64">
          <label className="block text-xs font-medium text-gray-700 mb-1">検索</label>
          <div className="relative">
            <input
              type="text"
              value={filters.search}
              onChange={e => onFilterChange({ search: e.target.value })}
              placeholder="送信内容やエラーメッセージで検索..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm 
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
              disabled={loading}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* ステータス */}
        <div className="min-w-40">
          <label className="block text-xs font-medium text-gray-700 mb-1">ステータス</label>
          <select
            value={filters.status}
            onChange={e => onFilterChange({ status: e.target.value })}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm 
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            disabled={loading}
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 企業 */}
        <div className="min-w-48">
          <label className="block text-xs font-medium text-gray-700 mb-1">企業</label>
          <select
            value={filters.companyId}
            onChange={e => onFilterChange({ companyId: e.target.value })}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm 
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            disabled={loading}
          >
            <option value="">すべての企業</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        {/* テンプレート */}
        <div className="min-w-48">
          <label className="block text-xs font-medium text-gray-700 mb-1">テンプレート</label>
          <select
            value={filters.templateId}
            onChange={e => onFilterChange({ templateId: e.target.value })}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm 
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            disabled={loading}
          >
            <option value="">すべてのテンプレート</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        {/* 送信日時（開始） */}
        <div className="min-w-40">
          <label className="block text-xs font-medium text-gray-700 mb-1">送信日時（開始）</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={e => onFilterChange({ dateFrom: e.target.value })}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm 
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            disabled={loading}
          />
        </div>

        {/* 送信日時（終了） */}
        <div className="min-w-40">
          <label className="block text-xs font-medium text-gray-700 mb-1">送信日時（終了）</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={e => onFilterChange({ dateTo: e.target.value })}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm 
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            disabled={loading}
          />
        </div>

        {/* クリアボタン */}
        {hasActiveFilters && (
          <div className="min-w-fit">
            <label className="block text-xs font-medium text-transparent mb-1">　</label>
            <button
              onClick={handleClearFilters}
              disabled={loading}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 
                         rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              クリア
            </button>
          </div>
        )}
      </div>

      {/* アクティブフィルターの表示 */}
      {hasActiveFilters && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500">アクティブフィルター:</span>
            
            {filters.status !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                ステータス: {statusOptions.find(s => s.value === filters.status)?.label}
                <button
                  onClick={() => onFilterChange({ status: 'all' })}
                  className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}

            {filters.companyId && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                企業: {companies.find(c => c.id === filters.companyId)?.name}
                <button
                  onClick={() => onFilterChange({ companyId: '' })}
                  className="ml-1 hover:bg-green-200 rounded-full p-0.5"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}

            {filters.templateId && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                テンプレート: {templates.find(t => t.id === filters.templateId)?.name}
                <button
                  onClick={() => onFilterChange({ templateId: '' })}
                  className="ml-1 hover:bg-purple-200 rounded-full p-0.5"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}

            {filters.dateFrom && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
                開始日: {filters.dateFrom}
                <button
                  onClick={() => onFilterChange({ dateFrom: '' })}
                  className="ml-1 hover:bg-orange-200 rounded-full p-0.5"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}

            {filters.dateTo && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
                終了日: {filters.dateTo}
                <button
                  onClick={() => onFilterChange({ dateTo: '' })}
                  className="ml-1 hover:bg-orange-200 rounded-full p-0.5"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}

            {filters.search && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                検索: {filters.search}
                <button
                  onClick={() => onFilterChange({ search: '' })}
                  className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 