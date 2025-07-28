import { useState } from 'react'
import { Company } from '../../types/models'

interface FormDetectionPanelProps {
  companies: Company[]
  selectedCompanyId: number | null
  isDetecting: boolean
  onDetect: (companyId: number, forceRefresh?: boolean) => void
}

export function FormDetectionPanel({
  companies,
  selectedCompanyId,
  isDetecting,
  onDetect
}: FormDetectionPanelProps) {
  const [localCompanyId, setLocalCompanyId] = useState(selectedCompanyId?.toString() || '')
  const [forceRefresh, setForceRefresh] = useState(false)

  const handleDetect = () => {
    if (localCompanyId) {
      const companyId = parseInt(localCompanyId, 10)
      if (!isNaN(companyId)) {
        onDetect(companyId, forceRefresh)
      }
    }
  }

  const selectedCompany = companies.find(c => c.id.toString() === localCompanyId)

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">フォーム検出</h3>
        
        <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm">
          ステップ 1
        </div>
      </div>

      <div className="space-y-4">
        {/* 企業選択 */}
        <div>
          <label htmlFor="company-select" className="block text-sm font-medium text-gray-700 mb-2">
            対象企業を選択
          </label>
          <select
            id="company-select"
            value={localCompanyId}
            onChange={(e) => setLocalCompanyId(e.target.value)}
            disabled={isDetecting}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 
                       focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 
                       disabled:cursor-not-allowed"
          >
            <option value="">企業を選択してください</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        {/* 選択された企業の詳細 */}
        {selectedCompany && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">{selectedCompany.name}</h4>
            <a
              href={selectedCompany.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 text-sm break-all"
            >
              {selectedCompany.url}
            </a>
            {selectedCompany.memo && (
              <p className="text-sm text-gray-600 mt-2">{selectedCompany.memo}</p>
            )}
            {selectedCompany.lastSubmittedAt && (
              <p className="text-xs text-gray-500 mt-2">
                最終送信: {new Date(selectedCompany.lastSubmittedAt).toLocaleString('ja-JP')}
              </p>
            )}
          </div>
        )}

        {/* オプション */}
        <div className="space-y-3">
          <div className="flex items-center">
            <input
              id="force-refresh"
              type="checkbox"
              checked={forceRefresh}
              onChange={(e) => setForceRefresh(e.target.checked)}
              disabled={isDetecting}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 
                         disabled:opacity-50"
            />
            <label htmlFor="force-refresh" className="ml-2 text-sm text-gray-700">
              強制リフレッシュ（既存の検出結果を無視）
            </label>
          </div>
        </div>

        {/* 実行ボタン */}
        <button
          onClick={handleDetect}
          disabled={!localCompanyId || isDetecting}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 
                     disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg 
                     transition-colors flex items-center justify-center gap-2"
        >
          {isDetecting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              検出中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              フォーム検出を開始
            </>
          )}
        </button>

        {/* 説明 */}
        <div className="text-sm text-gray-600 bg-blue-50 rounded-lg p-3">
          <div className="flex items-start">
            <svg className="w-4 h-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-blue-700 mb-1">フォーム検出について</p>
              <ul className="text-blue-600 space-y-1 text-xs">
                <li>• 企業サイトを自動解析し、問い合わせフォームを検出します</li>
                <li>• 検出には通常2-5秒程度かかります</li>
                <li>• 既に検出済みの場合は結果を再利用します</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 