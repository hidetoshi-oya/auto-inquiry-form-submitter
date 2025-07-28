import { Form } from '../../types/models'

interface DetectedFormsListProps {
  forms: Form[]
  selectedFormId: string | null
  onFormSelect: (formId: string) => void
  isSubmitting: boolean
}

export function DetectedFormsList({
  forms,
  selectedFormId,
  onFormSelect,
  isSubmitting
}: DetectedFormsListProps) {
  if (forms.length === 0) {
    return null
  }

  const getFieldTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
          </svg>
        )
      case 'textarea':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        )
      case 'select':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )
      case 'tel':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        )
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          検出されたフォーム ({forms.length}件)
        </h3>
        <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm">
          検出完了
        </div>
      </div>

      <div className="space-y-4">
        {forms.map((form) => {
          const isSelected = form.id === selectedFormId
          const requiredFields = form.fields.filter(field => field.required)
          
          return (
            <div
              key={form.id}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              } ${isSubmitting ? 'cursor-not-allowed opacity-60' : ''}`}
              onClick={() => !isSubmitting && onFormSelect(form.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className={`font-medium mb-1 ${
                    isSelected ? 'text-blue-900' : 'text-gray-900'
                  }`}>
                    問い合わせフォーム
                  </h4>
                  <a
                    href={form.formUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm break-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {form.formUrl}
                  </a>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  {form.hasRecaptcha && (
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                      CAPTCHA
                    </span>
                  )}
                  
                  {isSelected && (
                    <div className="bg-blue-500 text-white px-2 py-1 rounded-full text-xs">
                      選択中
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* フィールド情報 */}
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">
                    フィールド一覧 ({form.fields.length}件)
                  </h5>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {form.fields.map((field, index) => (
                      <div key={index} className="flex items-center text-xs bg-white rounded px-2 py-1">
                        {getFieldTypeIcon(field.type)}
                        <span className="ml-2 text-gray-700">
                          {field.label || field.name}
                        </span>
                        {field.required && (
                          <span className="ml-1 text-red-500">*</span>
                        )}
                        <span className="ml-auto text-gray-500 text-xs">
                          {field.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 統計情報 */}
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">統計情報</h5>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between bg-white rounded px-2 py-1">
                      <span className="text-gray-600">必須フィールド:</span>
                      <span className="font-medium text-gray-900">{requiredFields.length}件</span>
                    </div>
                    
                    <div className="flex justify-between bg-white rounded px-2 py-1">
                      <span className="text-gray-600">任意フィールド:</span>
                      <span className="font-medium text-gray-900">
                        {form.fields.length - requiredFields.length}件
                      </span>
                    </div>
                    
                    <div className="flex justify-between bg-white rounded px-2 py-1">
                      <span className="text-gray-600">検出日時:</span>
                      <span className="font-medium text-gray-900">
                        {new Date(form.detectedAt).toLocaleString('ja-JP', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* セレクタ情報（技術者向け） */}
              {isSelected && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-600 hover:text-gray-800 font-medium">
                      技術情報を表示
                    </summary>
                    <div className="mt-2 space-y-1 bg-gray-50 rounded p-2">
                      <div>
                        <span className="font-medium">送信ボタン:</span>
                        <code className="ml-2 text-blue-600">{form.submitButtonSelector}</code>
                      </div>
                      {form.fields.slice(0, 3).map((field, index) => (
                        <div key={index}>
                          <span className="font-medium">{field.name}:</span>
                          <code className="ml-2 text-blue-600">{field.selector}</code>
                        </div>
                      ))}
                      {form.fields.length > 3 && (
                        <div className="text-gray-500">... 他 {form.fields.length - 3} 件</div>
                      )}
                    </div>
                  </details>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-6 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
        <div className="flex items-start">
          <svg className="w-4 h-4 text-gray-500 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-medium text-gray-700 mb-1">検出結果について</p>
            <ul className="text-gray-600 space-y-1 text-xs">
              <li>• フォームを選択してから送信設定に進んでください</li>
              <li>• 必須フィールドは自動的にテンプレートでマッピングされます</li>
              <li>• CAPTCHAがあるフォームは手動確認が必要な場合があります</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
} 