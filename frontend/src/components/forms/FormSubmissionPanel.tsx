import { useState, useEffect } from 'react'
import { Form, Template } from '../../types/models'

interface FormSubmissionPanelProps {
  templates: Template[]
  detectedForms: Form[]
  selectedFormId: string | null
  isSubmitting: boolean
  submissionStatus: 'idle' | 'processing' | 'success' | 'error'
  onSubmit: (formId: string, templateId: string, templateData: Record<string, string>, dryRun?: boolean) => void
  disabled: boolean
}

interface FormData {
  selectedTemplateId: string
  templateData: Record<string, string>
  dryRun: boolean
}

export function FormSubmissionPanel({
  templates,
  detectedForms,
  selectedFormId,
  isSubmitting,
  submissionStatus,
  onSubmit,
  disabled
}: FormSubmissionPanelProps) {
  const [formData, setFormData] = useState<FormData>({
    selectedTemplateId: '',
    templateData: {},
    dryRun: true
  })

  const selectedTemplate = templates.find(t => t.id === formData.selectedTemplateId)
  const selectedForm = detectedForms.find(f => f.id === selectedFormId)

  // テンプレート変更時にデータをリセット
  useEffect(() => {
    if (selectedTemplate) {
      const initialData: Record<string, string> = {}
      selectedTemplate.variables.forEach(variable => {
        initialData[variable.key] = variable.defaultValue || ''
      })
      setFormData(prev => ({ ...prev, templateData: initialData }))
    }
  }, [selectedTemplate])

  const handleTemplateDataChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      templateData: { ...prev.templateData, [key]: value }
    }))
  }

  const handleSubmit = () => {
    if (selectedFormId && formData.selectedTemplateId) {
      onSubmit(
        selectedFormId,
        formData.selectedTemplateId,
        formData.templateData,
        formData.dryRun
      )
    }
  }

  const canSubmit = !disabled && 
                   selectedFormId && 
                   formData.selectedTemplateId && 
                   !isSubmitting

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">フォーム送信</h3>
        
        <div className={`px-3 py-1 rounded-full text-sm ${
          disabled ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'
        }`}>
          ステップ 2
        </div>
      </div>

      {disabled ? (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">フォーム検出が必要です</h4>
          <p className="text-gray-500">まず企業を選択してフォーム検出を実行してください</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 対象フォーム表示 */}
          {selectedForm && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">送信対象フォーム</h4>
              <a
                href={selectedForm.formUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm break-all"
              >
                {selectedForm.formUrl}
              </a>
              <div className="mt-2 flex items-center text-sm">
                <span className="text-blue-700">検出フィールド数: {selectedForm.fields.length}</span>
                {selectedForm.hasRecaptcha && (
                  <span className="ml-4 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                    CAPTCHA有り
                  </span>
                )}
              </div>
            </div>
          )}

          {/* テンプレート選択 */}
          <div>
            <label htmlFor="template-select" className="block text-sm font-medium text-gray-700 mb-2">
              送信テンプレートを選択
            </label>
            <select
              id="template-select"
              value={formData.selectedTemplateId}
              onChange={(e) => setFormData(prev => ({ ...prev, selectedTemplateId: e.target.value }))}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 
                         focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 
                         disabled:cursor-not-allowed"
            >
              <option value="">テンプレートを選択してください</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.category})
                </option>
              ))}
            </select>
          </div>

          {/* テンプレート変数の入力 */}
          {selectedTemplate && selectedTemplate.variables.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">テンプレート変数</h4>
              {selectedTemplate.variables.map((variable) => (
                <div key={variable.key}>
                  <label htmlFor={`var-${variable.key}`} className="block text-sm text-gray-600 mb-1">
                    {variable.name}
                  </label>
                  <input
                    id={`var-${variable.key}`}
                    type="text"
                    value={formData.templateData[variable.key] || ''}
                    onChange={(e) => handleTemplateDataChange(variable.key, e.target.value)}
                    disabled={isSubmitting}
                    placeholder={variable.defaultValue || `${variable.name}を入力`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 
                               focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 
                               disabled:cursor-not-allowed text-sm"
                  />
                </div>
              ))}
            </div>
          )}

          {/* オプション */}
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                id="dry-run"
                type="checkbox"
                checked={formData.dryRun}
                onChange={(e) => setFormData(prev => ({ ...prev, dryRun: e.target.checked }))}
                disabled={isSubmitting}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 
                           disabled:opacity-50"
              />
              <label htmlFor="dry-run" className="ml-2 text-sm text-gray-700">
                ドライラン（送信せずにプレビューのみ）
              </label>
            </div>
          </div>

          {/* プレビュー */}
          {selectedTemplate && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">送信内容プレビュー</h4>
              <div className="space-y-2 text-xs">
                {selectedTemplate.fields.map((field) => {
                  let value = field.value
                  if (field.type === 'variable') {
                    value = formData.templateData[field.key] || `{{${field.key}}}`
                  }
                  return (
                    <div key={field.key} className="flex">
                      <span className="text-gray-600 w-20 flex-shrink-0">{field.key}:</span>
                      <span className="text-gray-900 break-words">{value}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 送信ボタン */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 ${
              formData.dryRun
                ? 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300'
                : 'bg-red-500 hover:bg-red-600 text-white disabled:bg-gray-300'
            } disabled:cursor-not-allowed`}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {formData.dryRun ? 'プレビュー中...' : '送信中...'}
              </>
            ) : (
              <>
                {formData.dryRun ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
                {formData.dryRun ? 'プレビュー実行' : 'フォーム送信'}
              </>
            )}
          </button>

          {/* 注意事項 */}
          <div className="text-sm text-gray-600 bg-yellow-50 rounded-lg p-3">
            <div className="flex items-start">
              <svg className="w-4 h-4 text-yellow-500 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="font-medium text-yellow-700 mb-1">送信前の確認</p>
                <ul className="text-yellow-600 space-y-1 text-xs">
                  <li>• 初回はドライランで内容を確認することをお勧めします</li>
                  <li>• CAPTCHAがある場合は手動対応が必要になる場合があります</li>
                  <li>• 送信前に企業の利用規約をご確認ください</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 送信結果 */}
          {submissionStatus === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-green-700 font-medium">
                  {formData.dryRun ? 'プレビューが完了しました' : 'フォーム送信が完了しました'}
                </p>
              </div>
            </div>
          )}

          {submissionStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <p className="text-red-700 font-medium">送信に失敗しました</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 