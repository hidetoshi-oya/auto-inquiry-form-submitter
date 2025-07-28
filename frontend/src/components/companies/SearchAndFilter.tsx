import { useState } from 'react'

interface SearchFilters {
  search: string
  status: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

interface SearchAndFilterProps {
  filters: SearchFilters
  onFilterChange: (filters: Partial<SearchFilters>) => void
  onRefresh: () => void
  loading: boolean
}

export function SearchAndFilter({ 
  filters, 
  onFilterChange, 
  onRefresh, 
  loading 
}: SearchAndFilterProps) {
  const [localSearch, setLocalSearch] = useState(filters.search)

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onFilterChange({ search: localSearch })
  }

  const handleSearchClear = () => {
    setLocalSearch('')
    onFilterChange({ search: '' })
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* 検索 */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSearchSubmit} className="relative">
            <div className="relative">
              <input
                type="text"
                placeholder="企業名またはURLで検索..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="w-full pl-10 pr-20 py-2 border border-gray-300 rounded-lg 
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           text-sm"
              />
              <svg 
                className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                />
              </svg>
              
              {/* 検索クリアボタン */}
              {localSearch && (
                <button
                  type="button"
                  onClick={handleSearchClear}
                  className="absolute right-12 top-2.5 h-4 w-4 text-gray-400 hover:text-gray-600"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              
              {/* 検索ボタン */}
              <button
                type="submit"
                disabled={loading}
                className="absolute right-2 top-1.5 px-2 py-1 bg-blue-500 text-white text-xs 
                           rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                検索
              </button>
            </div>
          </form>
        </div>

        {/* ステータスフィルター */}
        <div>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ status: e.target.value })}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg 
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="all">すべてのステータス</option>
            <option value="active">アクティブ</option>
            <option value="inactive">非アクティブ</option>
            <option value="blocked">ブロック済み</option>
          </select>
        </div>

        {/* ソート */}
        <div className="flex space-x-2">
          <select
            value={filters.sortBy}
            onChange={(e) => onFilterChange({ sortBy: e.target.value })}
            className="flex-1 py-2 px-3 border border-gray-300 rounded-lg 
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="name">企業名</option>
            <option value="createdAt">作成日時</option>
            <option value="lastSubmittedAt">最終送信日時</option>
          </select>
          
          <button
            onClick={() => onFilterChange({ 
              sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' 
            })}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 
                       transition-colors text-sm"
            title={filters.sortOrder === 'asc' ? '降順に並び替え' : '昇順に並び替え'}
          >
            {filters.sortOrder === 'asc' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* フィルター状況とリフレッシュ */}
      <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          {filters.search && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
              検索: {filters.search}
              <button
                onClick={() => onFilterChange({ search: '' })}
                className="ml-1 h-4 w-4 text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          )}
          
          {filters.status !== 'all' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-green-100 text-green-800">
              ステータス: {filters.status}
              <button
                onClick={() => onFilterChange({ status: 'all' })}
                className="ml-1 h-4 w-4 text-green-600 hover:text-green-800"
              >
                ×
              </button>
            </span>
          )}
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900 
                     disabled:opacity-50 transition-colors"
        >
          <svg 
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
          <span>更新</span>
        </button>
      </div>
    </div>
  )
} 