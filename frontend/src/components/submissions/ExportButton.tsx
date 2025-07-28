import { useState } from 'react'
import { Submission } from '../../types/models'

interface SubmissionFilters {
  status: string
  companyId: number | string
  templateId: string
  dateFrom: string
  dateTo: string
  search: string
}

interface ExportButtonProps {
  submissions: Submission[]
  filters: SubmissionFilters
  total: number
  disabled?: boolean
}

export function ExportButton({
  submissions,
  total,
  disabled = false
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [showOptions, setShowOptions] = useState(false)

  // CSVデータの生成
  const generateCSV = (exportAll: boolean = false) => {
    const headers = [
      '送信ID',
      '送信日時',
      '企業ID',
      '企業名',
      'テンプレートID',
      'テンプレート名',
      'ステータス',
      '送信データ',
      'レスポンス',
      'エラーメッセージ',
      'スクリーンショットURL'
    ]

    // データの準備
    const dataToExport = exportAll ? submissions : submissions

    const csvRows = [
      headers.join(','), // ヘッダー行
      ...dataToExport.map(submission => {
        return [
          `"${submission.id}"`,
          `"${new Date(submission.submittedAt).toLocaleString('ja-JP')}"`,
          `"${submission.companyId}"`,
          `"企業名"`, // 実際の実装では企業名をマップから取得
          `"${submission.templateId}"`,
          `"テンプレート名"`, // 実際の実装ではテンプレート名をマップから取得
          `"${getStatusLabel(submission.status)}"`,
          `"${JSON.stringify(submission.submittedData).replace(/"/g, '""')}"`,
          `"${submission.response || ''}"`,
          `"${submission.errorMessage || ''}"`,
          `"${submission.screenshotUrl || ''}"`
        ].join(',')
      })
    ]

    return csvRows.join('\n')
  }

  // ステータスラベルの取得
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'success': return '送信成功'
      case 'failed': return '送信失敗'
      case 'pending': return '送信中'
      case 'captcha_required': return 'CAPTCHA必要'
      default: return '不明'
    }
  }

  // CSVファイルのダウンロード
  const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  // 現在の表示データをエクスポート
  const handleExportCurrent = async () => {
    setIsExporting(true)
    setShowOptions(false)

    try {
      const csvContent = generateCSV(false)
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const filename = `submissions_current_${timestamp}.csv`
      
      downloadCSV(csvContent, filename)
    } catch (error) {
      console.error('Export failed:', error)
      alert('エクスポートに失敗しました')
    } finally {
      setIsExporting(false)
    }
  }

  // 全データをエクスポート（実際の実装では API を呼び出し）
  const handleExportAll = async () => {
    setIsExporting(true)
    setShowOptions(false)

    try {
      // TODO: 実際の実装では API を呼び出してすべてのデータを取得
      // const allSubmissions = await fetchAllSubmissions(filters)
      const csvContent = generateCSV(true)
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const filename = `submissions_all_${timestamp}.csv`
      
      downloadCSV(csvContent, filename)
    } catch (error) {
      console.error('Export failed:', error)
      alert('エクスポートに失敗しました')
    } finally {
      setIsExporting(false)
    }
  }

  const hasData = submissions.length > 0

  return (
    <div className="relative">
      <button
        onClick={() => setShowOptions(!showOptions)}
        disabled={disabled || !hasData || isExporting}
        className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed 
                   text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors 
                   flex items-center gap-2"
      >
        {isExporting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            エクスポート中...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            CSVエクスポート
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {/* エクスポートオプション */}
      {showOptions && (
        <>
          {/* バックドロップ */}
          <div 
            className="fixed inset-0 z-10"
            onClick={() => setShowOptions(false)}
          />
          
          {/* ドロップダウンメニュー */}
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="p-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">エクスポートオプション</h4>
              
              <button
                onClick={handleExportCurrent}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">現在の表示データ</p>
                    <p className="text-xs text-gray-500">{submissions.length}件</p>
                  </div>
                </div>
              </button>

              <button
                onClick={handleExportAll}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors mt-1"
              >
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">すべてのデータ</p>
                    <p className="text-xs text-gray-500">フィルター条件に基づく全{total}件</p>
                  </div>
                </div>
              </button>
            </div>

            <div className="px-3 pb-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mt-2">
                CSVファイルには送信日時、企業名、ステータス、送信内容などの詳細情報が含まれます。
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
} 