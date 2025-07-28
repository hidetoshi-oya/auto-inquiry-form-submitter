import { Company } from '../../types/models'

interface FormProgressTrackerProps {
  selectedCompany: Company | undefined
  detectedFormsCount: number
  isDetecting: boolean
  isSubmitting: boolean
  submissionStatus: 'idle' | 'processing' | 'success' | 'error'
}

export function FormProgressTracker({
  selectedCompany,
  detectedFormsCount,
  isDetecting,
  isSubmitting,
  submissionStatus
}: FormProgressTrackerProps) {
  const steps = [
    {
      id: 'company',
      label: '企業選択',
      completed: !!selectedCompany,
      active: !selectedCompany
    },
    {
      id: 'detection',
      label: 'フォーム検出',
      completed: detectedFormsCount > 0,
      active: isDetecting || (!!selectedCompany && detectedFormsCount === 0)
    },
    {
      id: 'submission',
      label: 'フォーム送信',
      completed: submissionStatus === 'success',
      active: isSubmitting || detectedFormsCount > 0
    }
  ]

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">処理状況</h3>
        
        {/* ステータス表示 */}
        <div className="flex items-center space-x-2">
          {isDetecting && (
            <div className="flex items-center text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-sm">検出中...</span>
            </div>
          )}
          
          {isSubmitting && (
            <div className="flex items-center text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-sm">送信中...</span>
            </div>
          )}
          
          {submissionStatus === 'success' && (
            <div className="flex items-center text-green-600">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm">送信完了</span>
            </div>
          )}
          
          {submissionStatus === 'error' && (
            <div className="flex items-center text-red-600">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-sm">送信失敗</span>
            </div>
          )}
        </div>
      </div>

      {/* ステップ表示 */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            {/* ステップアイコン */}
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                step.completed 
                  ? 'bg-green-500 border-green-500 text-white'
                  : step.active
                    ? 'border-blue-500 text-blue-500 bg-blue-50'
                    : 'border-gray-300 text-gray-400'
              }`}>
                {step.completed ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}
              </div>
              
              <span className={`mt-2 text-sm font-medium ${
                step.completed
                  ? 'text-green-600'
                  : step.active
                    ? 'text-blue-600'
                    : 'text-gray-500'
              }`}>
                {step.label}
              </span>
            </div>

            {/* 接続線 */}
            {index < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-4 ${
                step.completed ? 'bg-green-500' : 'bg-gray-300'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* 詳細情報 */}
      <div className="mt-6 grid grid-cols-3 gap-4 text-center">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-lg font-semibold text-gray-900">
            {selectedCompany ? '1' : '0'}
          </div>
          <div className="text-sm text-gray-600">選択企業</div>
          {selectedCompany && (
            <div className="text-xs text-gray-500 mt-1 truncate">
              {selectedCompany.name}
            </div>
          )}
        </div>
        
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-lg font-semibold text-gray-900">
            {detectedFormsCount}
          </div>
          <div className="text-sm text-gray-600">検出フォーム</div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-3">
          <div className={`text-lg font-semibold ${
            submissionStatus === 'success' ? 'text-green-600' :
            submissionStatus === 'error' ? 'text-red-600' : 'text-gray-900'
          }`}>
            {submissionStatus === 'success' ? '完了' :
             submissionStatus === 'error' ? 'エラー' :
             submissionStatus === 'processing' ? '処理中' : '待機中'}
          </div>
          <div className="text-sm text-gray-600">送信状況</div>
        </div>
      </div>
    </div>
  )
} 