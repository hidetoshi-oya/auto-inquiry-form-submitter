import { api } from './api'
import { Form } from '../types/models'

/**
 * フォーム検出関連API関数群
 * バックエンドの /forms エンドポイントと連携
 */

/**
 * フォーム検出リクエスト型
 */
export interface FormDetectionRequest {
  company_id: number
  force_refresh?: boolean
}

/**
 * フォーム検出レスポンス型（タスク開始）
 */
export interface FormDetectionTaskResponse {
  message: string
  company_id: number
  company_url: string
  task_id: string
  status: 'processing' | 'existing'
  existing_forms_count?: number
}

/**
 * フォームフィールド型（バックエンドAPI用）
 */
export interface FormFieldResponse {
  id: number
  form_id: number
  name: string
  field_type: string
  selector: string
  label?: string
  required: boolean
  options?: string[]
}

/**
 * フォームレスポンス型（バックエンドAPI用）
 */
export interface FormResponse {
  id: number
  company_id: number
  form_url: string
  submit_button_selector: string
  has_recaptcha: boolean
  detected_at: string
  created_at: string
  updated_at: string
  fields: FormFieldResponse[]
}

/**
 * フォーム検出を開始
 */
export const startFormDetection = async (
  request: FormDetectionRequest
): Promise<FormDetectionTaskResponse> => {
  return await api.post<FormDetectionTaskResponse>('/forms/detect', request)
}

/**
 * 特定企業の検出済みフォーム一覧を取得
 */
export const getCompanyForms = async (companyId: number): Promise<Form[]> => {
  const response = await api.get<FormResponse[]>(`/forms/company/${companyId}`)
  
  // バックエンドのレスポンスをフロントエンドの型に変換
  return response.map(convertFormResponseToForm)
}

/**
 * フォーム詳細を取得
 */
export const getForm = async (formId: number): Promise<Form> => {
  const response = await api.get<FormResponse>(`/forms/${formId}`)
  return convertFormResponseToForm(response)
}

/**
 * フォームを削除
 */
export const deleteForm = async (formId: number): Promise<void> => {
  await api.delete(`/forms/${formId}`)
}

/**
 * バックエンドのFormResponseをフロントエンドのForm型に変換
 */
function convertFormResponseToForm(formResponse: FormResponse): Form {
  return {
    id: formResponse.id.toString(),
    companyId: formResponse.company_id,
    formUrl: formResponse.form_url,
    fields: formResponse.fields.map(field => ({
      name: field.name,
      type: field.field_type as any, // 型の互換性のため
      selector: field.selector,
      label: field.label,
      required: field.required,
      options: field.options
    })),
    submitButtonSelector: formResponse.submit_button_selector,
    hasRecaptcha: formResponse.has_recaptcha,
    detectedAt: new Date(formResponse.detected_at)
  }
}

/**
 * フォーム検出とポーリングによる結果取得を統合した関数
 */
export const detectAndGetForms = async (
  companyId: number, 
  forceRefresh: boolean = false,
  pollInterval: number = 2000,
  maxAttempts: number = 30
): Promise<Form[]> => {
  console.group('🚀 フォーム検出プロセス開始')
  console.log(`🏢 企業ID: ${companyId}`)
  console.log(`🔄 強制リフレッシュ: ${forceRefresh}`)
  console.log(`⏱️ ポーリング間隔: ${pollInterval}ms`)
  console.log(`🎯 最大試行回数: ${maxAttempts}`)
  console.log(`⌛ 最大タイムアウト: ${Math.round((maxAttempts * pollInterval) / 1000)}秒`)
  console.log(`⏰ 開始時刻: ${new Date().toISOString()}`)
  console.groupEnd()
  
  // フォーム検出を開始
  const detectionResponse = await startFormDetection({
    company_id: companyId,
    force_refresh: forceRefresh
  })
  
  console.group('📤 フォーム検出レスポンス')
  console.log('🎯 ステータス:', detectionResponse.status)
  console.log('🏢 企業URL:', detectionResponse.company_url)
  console.log('🆔 タスクID:', detectionResponse.task_id)
  if (detectionResponse.existing_forms_count !== undefined) {
    console.log('📊 既存フォーム数:', detectionResponse.existing_forms_count)
  }
  console.groupEnd()

  // 既存のフォームがある場合はそれを返す
  if (detectionResponse.status === 'existing' && !forceRefresh) {
    console.group('📋 既存フォーム取得')
    console.log('🎯 ステータス: 既存フォームを使用')
    console.log(`📊 既存フォーム数: ${detectionResponse.existing_forms_count || 'Unknown'}`)
    console.log(`⏰ 取得時刻: ${new Date().toISOString()}`)
    console.groupEnd()
    
    const existingForms = await getCompanyForms(companyId)
    
    console.group('✅ 既存フォーム取得完了')
    console.log(`📊 実際に取得されたフォーム数: ${existingForms.length}`)
    existingForms.forEach((form, index) => {
      console.log(`  ${index + 1}. ${form.formUrl} (ID: ${form.id})`)
    })
    console.groupEnd()
    
    return existingForms
  }

  // タスクが開始された場合は、完了を待つ
  if (detectionResponse.status === 'processing') {
    // 簡単なポーリング実装 (実際のプロダクションではWebSocketやServer-Sent Eventsを使用することを推奨)
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))
      
      try {
        // フォーム一覧を取得してみる
        const forms = await getCompanyForms(companyId)
        if (forms.length > 0) {
          console.group('✅ フォーム検出完了')
          console.log(`📊 検出されたフォーム数: ${forms.length}`)
          console.log(`⏱️ 所要時間: ${Math.round((attempt + 1) * pollInterval / 1000)}秒`)
          console.log(`🎯 試行回数: ${attempt + 1}/${maxAttempts}`)
          console.log(`⏰ 完了時刻: ${new Date().toISOString()}`)
          console.log('📋 検出されたフォーム一覧:')
          forms.forEach((form, index) => {
            console.log(`  ${index + 1}. ${form.formUrl} (ID: ${form.id})`)
          })
          console.groupEnd()
          return forms
        }
      } catch (error) {
        // まだ検出が完了していない可能性があるため、継続
        const progress = Math.round(((attempt + 1) / maxAttempts) * 100)
        const remainingTime = Math.round((maxAttempts - attempt - 1) * pollInterval / 1000)
        
        console.group('🔄 フォーム検出ポーリング状況')
        console.log(`📊 進行状況: ${progress}% (${attempt + 1}/${maxAttempts})`)
        console.log(`⏱️ 残り時間: 約${remainingTime}秒`)
        console.log(`🏢 企業ID: ${companyId}`)
        console.log(`🔍 ポーリング間隔: ${pollInterval}ms`)
        console.log(`⏰ タイムスタンプ: ${new Date().toISOString()}`)
        if (error instanceof Error) {
          console.log(`❗ エラー詳細: ${error.message}`)
        }
        console.groupEnd()
      }
    }
    
    const totalTimeSeconds = Math.round((maxAttempts * pollInterval) / 1000)
    
    console.group('⏰ フォーム検出タイムアウト')
    console.log(`⌛ 経過時間: ${totalTimeSeconds}秒`)
    console.log(`🎯 試行回数: ${maxAttempts}回`)
    console.log(`🏢 企業ID: ${companyId}`)
    console.log(`🆔 タスクID: ${detectionResponse.task_id}`)
    console.log(`⏰ タイムアウト時刻: ${new Date().toISOString()}`)
    console.log('💡 対処方法:')
    console.log('  • 「再試行」ボタンをクリック')
    console.log('  • 時間をおいてから再実行')
    console.log('  • ネットワーク接続確認')
    console.groupEnd()
    
    throw new Error(`フォーム検出がタイムアウトしました（${totalTimeSeconds}秒経過）。\n\n考えられる原因：\n• サーバーの負荷が高い\n• 企業サイトの応答が遅い\n• ネットワーク接続の問題\n\n「再試行」ボタンをクリックして再度実行するか、しばらく時間をおいてから再試行してください。`)
  }

  // その他の場合は空配列を返す
  console.group('❓ 予期しないステータス')
  console.log('🎯 ステータス:', detectionResponse.status)
  console.log('🏢 企業ID:', companyId)
  console.log('🔄 強制リフレッシュ:', forceRefresh)
  console.log('⏰ 時刻:', new Date().toISOString())
  console.log('📤 空配列を返却します')
  console.groupEnd()
  
  return []
}