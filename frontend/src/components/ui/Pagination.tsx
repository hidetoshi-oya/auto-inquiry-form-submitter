interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  showTotal?: boolean
  total?: number
  perPage?: number
}

export function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  showTotal = false,
  total = 0,
  perPage = 20
}: PaginationProps) {
  if (totalPages <= 1) return null

  const getVisiblePages = () => {
    const delta = 2
    const range = []
    const rangeWithDots = []

    for (let i = Math.max(2, currentPage - delta); 
         i <= Math.min(totalPages - 1, currentPage + delta); 
         i++) {
      range.push(i)
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...')
    } else {
      rangeWithDots.push(1)
    }

    rangeWithDots.push(...range)

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages)
    } else {
      rangeWithDots.push(totalPages)
    }

    return rangeWithDots
  }

  const pages = getVisiblePages()

  const PaginationButton = ({ 
    page, 
    isActive = false, 
    isDots = false 
  }: { 
    page: number | string
    isActive?: boolean
    isDots?: boolean 
  }) => {
    if (isDots) {
      return (
        <span className="px-3 py-2 text-gray-500">
          {page}
        </span>
      )
    }

    return (
      <button
        onClick={() => typeof page === 'number' && onPageChange(page)}
        disabled={isActive}
        className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          isActive
            ? 'bg-blue-500 text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        {page}
      </button>
    )
  }

  return (
    <div className="flex items-center justify-between">
      {showTotal && (
        <div className="text-sm text-gray-700">
          <span>
            全 <span className="font-medium">{total}</span> 件中{' '}
            <span className="font-medium">{Math.min((currentPage - 1) * perPage + 1, total)}</span> - {' '}
            <span className="font-medium">{Math.min(currentPage * perPage, total)}</span> 件を表示
          </span>
        </div>
      )}

      <nav className="flex items-center space-x-1">
        {/* 前のページ */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md 
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          前へ
        </button>

        {/* ページ番号 */}
        <div className="flex space-x-1">
          {pages.map((page, index) => (
            <PaginationButton
              key={index}
              page={page}
              isActive={page === currentPage}
              isDots={page === '...'}
            />
          ))}
        </div>

        {/* 次のページ */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md 
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          次へ
        </button>
      </nav>
    </div>
  )
} 