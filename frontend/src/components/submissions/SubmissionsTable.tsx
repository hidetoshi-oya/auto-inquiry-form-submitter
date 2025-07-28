import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  type Column
} from '@tanstack/react-table'
import { useMemo } from 'react'
import { Submission, Company, Template } from '../../types/models'

interface SubmissionsTableProps {
  submissions: Submission[]
  companies: Company[]
  templates: Template[]
  onView: (submissionId: string) => void
  onDelete: (submissionId: string) => void
  loading?: boolean
}

const columnHelper = createColumnHelper<Submission>()

export function SubmissionsTable({
  submissions,
  companies,
  templates,
  onView,
  onDelete,
  loading = false
}: SubmissionsTableProps) {
  
  // 会社名とテンプレート名のマップを作成
  const companyMap = useMemo(() => {
    return companies.reduce((acc, company) => {
      acc[company.id] = company.name
      return acc
    }, {} as Record<string, string>)
  }, [companies])

  const templateMap = useMemo(() => {
    return templates.reduce((acc, template) => {
      acc[template.id] = template.name
      return acc
    }, {} as Record<string, string>)
  }, [templates])

  const columns = useMemo(
    () => [
      columnHelper.accessor('submittedAt', {
        header: '送信日時',
        cell: info => (
          <div className="text-sm">
            <div>{new Date(info.getValue()).toLocaleDateString('ja-JP')}</div>
            <div className="text-gray-500">
              {new Date(info.getValue()).toLocaleTimeString('ja-JP', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
          </div>
        ),
        enableSorting: true,
        sortingFn: 'datetime'
      }),
      columnHelper.accessor('companyId', {
        header: '企業名',
        cell: info => (
          <div className="font-medium text-gray-900">
            {companyMap[info.getValue()] || '不明'}
          </div>
        ),
        enableSorting: true,
        filterFn: 'includesString'
      }),
      columnHelper.accessor('templateId', {
        header: 'テンプレート',
        cell: info => (
          <div className="text-sm text-gray-700">
            {templateMap[info.getValue()] || '不明'}
          </div>
        ),
        enableSorting: true,
        filterFn: 'includesString'
      }),
      columnHelper.accessor('status', {
        header: 'ステータス',
        cell: info => {
          const status = info.getValue()
          const statusConfig = getStatusConfig(status)
          return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.className}`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${statusConfig.dotColor}`}></span>
              {statusConfig.label}
            </span>
          )
        },
        enableSorting: true,
        filterFn: 'equals'
      }),
      columnHelper.accessor('submittedData', {
        header: '送信内容',
        cell: info => {
          const data = info.getValue()
          const message = data?.message || data?.content || ''
          return (
            <div className="max-w-xs truncate text-sm text-gray-600" title={message}>
              {message || '-'}
            </div>
          )
        },
        enableSorting: false,
        enableColumnFilter: false
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: info => (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onView(info.row.original.id)}
              className="text-blue-600 hover:text-blue-900 text-sm font-medium"
            >
              詳細
            </button>
            <button
              onClick={() => onDelete(info.row.original.id)}
              className="text-red-600 hover:text-red-900 text-sm font-medium"
            >
              削除
            </button>
          </div>
        ),
        enableSorting: false,
        enableColumnFilter: false
      })
    ],
    [companyMap, templateMap, onView, onDelete]
  )

  const table = useReactTable({
    data: submissions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableSorting: true,
    enableFilters: true,
    manualPagination: true, // ページネーションは親で管理
    manualSorting: false,   // クライアントサイドソート
    manualFiltering: false  // クライアントサイドフィルタ
  })

  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={`flex items-center gap-2 ${
                          header.column.getCanSort() ? 'cursor-pointer select-none' : ''
                        }`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <SortIcon column={header.column} />
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    <span className="ml-2 text-gray-500">読み込み中...</span>
                  </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500">
                  データがありません
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ソートアイコンコンポーネント
function SortIcon({ column }: { column: Column<any> }) {
  const sorted = column.getIsSorted()

  if (sorted === 'asc') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    )
  }

  if (sorted === 'desc') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  )
}

// ステータス設定の取得
function getStatusConfig(status: string) {
  switch (status) {
    case 'success':
      return {
        label: '送信成功',
        className: 'bg-green-100 text-green-800',
        dotColor: 'bg-green-500'
      }
    case 'failed':
      return {
        label: '送信失敗',
        className: 'bg-red-100 text-red-800',
        dotColor: 'bg-red-500'
      }
    case 'pending':
      return {
        label: '送信中',
        className: 'bg-yellow-100 text-yellow-800',
        dotColor: 'bg-yellow-500'
      }
    case 'captcha_required':
      return {
        label: 'CAPTCHA必要',
        className: 'bg-orange-100 text-orange-800',
        dotColor: 'bg-orange-500'
      }
    default:
      return {
        label: '不明',
        className: 'bg-gray-100 text-gray-800',
        dotColor: 'bg-gray-500'
      }
  }
} 