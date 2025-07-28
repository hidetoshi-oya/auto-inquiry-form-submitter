import { useState, useEffect } from 'react'
import { Company } from '../../types/models'
import { createCompany, updateCompany } from '../../services/companies'
import { CreateCompanyRequest, UpdateCompanyRequest } from '../../types/api'

interface CompanyModalProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  company: Company | null
  onClose: () => void
  onSave: (company: Company) => void
}

interface FormData {
  name: string
  url: string
  status: 'active' | 'inactive' | 'blocked'
  memo: string
}

const initialFormData: FormData = {
  name: '',
  url: '',
  status: 'active',
  memo: ''
}

export function CompanyModal({ 
  isOpen, 
  mode, 
  company, 
  onClose, 
  onSave 
}: CompanyModalProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<Partial<FormData>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // フォームデータを初期化
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && company) {
        setFormData({
          name: company.name,
          url: company.url,
          status: company.status,
          memo: company.memo || ''
        })
      } else {
        setFormData(initialFormData)
      }
      setErrors({})
      setIsSubmitting(false)
    }
  }, [isOpen, mode, company])

  // フィールド変更ハンドラー
  const handleFieldChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // エラーをクリア
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  // バリデーション
  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {}

    if (!formData.name.trim()) {
      newErrors.name = '企業名は必須です'
    }

    if (!formData.url.trim()) {
      newErrors.url = 'URLは必須です'
    } else {
      try {
        new URL(formData.url)
      } catch {
        newErrors.url = '有効なURLを入力してください'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // フォーム送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      let savedCompany: Company
      
      if (mode === 'create') {
        const createData: CreateCompanyRequest = {
          name: formData.name.trim(),
          url: formData.url.trim(),
          memo: formData.memo.trim() || undefined,
        }
        
        if (formData.status !== 'active') {
          // @ts-ignore: status is not in CreateCompanyRequest but backend accepts it
          createData.status = formData.status
        }
        
        savedCompany = await createCompany(createData)
      } else {
        if (!company?.id) {
          throw new Error('Company ID is required for update')
        }
        
        const updateData: UpdateCompanyRequest = {
          name: formData.name.trim(),
          url: formData.url.trim(),
          status: formData.status,
          memo: formData.memo.trim() || undefined,
        }
        
        savedCompany = await updateCompany(company.id, updateData)
      }

      onSave(savedCompany)
    } catch (error: any) {
      console.error('保存エラー:', error)
      
      // エラーメッセージを設定
      let errorMessage = '保存に失敗しました'
      
      if (error.message) {
        if (error.message.includes('Company with this URL already exists')) {
          errorMessage = 'このURLを持つ企業は既に登録されています'
        } else if (error.message.includes('timeout')) {
          errorMessage = 'リクエストがタイムアウトしました。もう一度お試しください'
        } else {
          errorMessage = error.message
        }
      }
      
      // エラー表示（簡易的にalertを使用）
      alert(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* オーバーレイ */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* モーダルコンテンツ */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* ヘッダー */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {mode === 'create' ? '企業を追加' : '企業を編集'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* フォーム */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* 企業名 */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                企業名 <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                disabled={isSubmitting}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 
                           focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed
                           ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="株式会社Example"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* URL */}
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
                URL <span className="text-red-500">*</span>
              </label>
              <input
                id="url"
                type="url"
                value={formData.url}
                onChange={(e) => handleFieldChange('url', e.target.value)}
                disabled={isSubmitting}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 
                           focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed
                           ${errors.url ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="https://example.com"
              />
              {errors.url && (
                <p className="mt-1 text-sm text-red-600">{errors.url}</p>
              )}
            </div>

            {/* ステータス */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                ステータス
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => handleFieldChange('status', e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 
                           focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 
                           disabled:cursor-not-allowed"
              >
                <option value="active">アクティブ</option>
                <option value="inactive">非アクティブ</option>
                <option value="blocked">ブロック済み</option>
              </select>
            </div>

            {/* メモ */}
            <div>
              <label htmlFor="memo" className="block text-sm font-medium text-gray-700 mb-1">
                メモ
              </label>
              <textarea
                id="memo"
                rows={3}
                value={formData.memo}
                onChange={(e) => handleFieldChange('memo', e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 
                           focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 
                           disabled:cursor-not-allowed resize-none"
                placeholder="この企業に関するメモ..."
              />
            </div>

            {/* アクションボタン */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border 
                           border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 
                           disabled:cursor-not-allowed transition-colors"
              >
                キャンセル
              </button>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg 
                           hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed 
                           transition-colors flex items-center gap-2"
              >
                {isSubmitting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {isSubmitting ? '保存中...' : (mode === 'create' ? '追加' : '更新')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 