import { api } from './api'

/**
 * フォーム送信関連API関数群
 * バックエンドの /submissions エンドポイントと連携
 */

/**
 * 単一フォーム送信リクエスト型
 */
export interface SingleSubmissionRequest {
  form_id: number
  template_id: number
  template_data: Record<string, any>
  take_screenshot?: boolean
  dry_run?: boolean
}

/**
 * 単一フォーム送信レスポンス型
 */
export interface SingleSubmissionResponse {
  message: string
  form_id: number
  template_id: number
  dry_run: boolean
  task_id: string
  status: string
}

/**
 * 送信履歴レスポンス型
 */
export interface SubmissionResponse {
  id: number
  company_id: number
  form_id?: number
  template_id: number
  status: 'pending' | 'success' | 'failed' | 'captcha_required'
  submitted_data: Record<string, any>
  response?: string
  error_message?: string
  submitted_at: string
  screenshot_url?: string
  created_at: string
  updated_at: string
  company_name?: string
  template_name?: string
}

/**
 * 送信履歴一覧レスポンス型
 */
export interface SubmissionListResponse {
  items: SubmissionResponse[]
  total: number
  page: number
  per_page: number
  pages: number
}

/**
 * バッチ送信リクエスト型
 */
export interface BatchSubmissionRequest {
  company_ids: number[]
  template_id: number
  interval_seconds?: number
  test_mode?: boolean
}

/**
 * バッチ送信レスポンス型
 */
export interface BatchSubmissionResponse {
  message: string
  company_count: number
  template_id: number
  interval_seconds: number
  test_mode: boolean
  task_id: string
  status: string
}

/**
 * タスクステータスレスポンス型
 */
export interface TaskStatusResponse {
  task_id: string
  status: 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | 'REVOKED'
  result?: any
  info?: any
  traceback?: string
}

/**
 * 送信統計レスポンス型
 */
export interface SubmissionStatsResponse {
  period_days: number
  total_submissions: number
  recent_submissions: number
  success_rate: number
  status_breakdown: Record<string, number>
  period: {
    start_date: string
    end_date: string
  }
}

/**
 * 単一フォーム送信を実行
 */
export const submitSingleForm = async (
  request: SingleSubmissionRequest
): Promise<SingleSubmissionResponse> => {
  return await api.post<SingleSubmissionResponse>('/submissions/single', request)
}

/**
 * バッチ送信を実行
 */
export const submitBatchForms = async (
  request: BatchSubmissionRequest
): Promise<BatchSubmissionResponse> => {
  return await api.post<BatchSubmissionResponse>('/submissions/batch', request)
}

/**
 * 送信履歴一覧を取得
 */
export const getSubmissions = async (params?: {
  page?: number
  per_page?: number
  company_id?: number
  status?: string
  start_date?: string
  end_date?: string
}): Promise<SubmissionListResponse> => {
  return await api.get<SubmissionListResponse>('/submissions/', { params })
}

/**
 * 送信履歴詳細を取得
 */
export const getSubmission = async (submissionId: number): Promise<SubmissionResponse> => {
  return await api.get<SubmissionResponse>(`/submissions/${submissionId}`)
}

/**
 * 企業の最新送信履歴を取得
 */
export const getLatestSubmissionByCompany = async (companyId: number): Promise<SubmissionResponse | null> => {
  return await api.get<SubmissionResponse | null>(`/submissions/company/${companyId}/latest`)
}

/**
 * 送信統計を取得
 */
export const getSubmissionStats = async (days: number = 30): Promise<SubmissionStatsResponse> => {
  return await api.get<SubmissionStatsResponse>('/submissions/stats', {
    params: { days }
  })
}

/**
 * 送信履歴を削除
 */
export const deleteSubmission = async (submissionId: number): Promise<void> => {
  await api.delete(`/submissions/${submissionId}`)
}

/**
 * Celeryタスクのステータスを取得
 */
export const getTaskStatus = async (taskId: string): Promise<TaskStatusResponse> => {
  return await api.get<TaskStatusResponse>(`/tasks/${taskId}/status`)
}

/**
 * フォーム送信とタスク監視を統合した関数
 */
export const submitFormAndWaitForResult = async (
  request: SingleSubmissionRequest,
  pollInterval: number = 2000,
  maxAttempts: number = 30
): Promise<{
  success: boolean
  result?: any
  error?: string
  task_id: string
}> => {
  console.group('🚀 フォーム送信プロセス開始')
  console.log(`📝 フォームID: ${request.form_id}`)
  console.log(`📋 テンプレートID: ${request.template_id}`)
  console.log(`🏃 ドライラン: ${request.dry_run ? 'はい' : 'いいえ'}`)
  console.log(`📸 スクリーンショット: ${request.take_screenshot ? 'はい' : 'いいえ'}`)
  console.log(`⏱️ ポーリング間隔: ${pollInterval}ms`)
  console.log(`🎯 最大試行回数: ${maxAttempts}`)
  console.log(`⏰ 開始時刻: ${new Date().toISOString()}`)
  console.groupEnd()

  try {
    // フォーム送信を開始
    const submissionResponse = await submitSingleForm(request)
    
    console.group('📤 フォーム送信レスポンス')
    console.log('🎯 ステータス:', submissionResponse.status)
    console.log('🆔 タスクID:', submissionResponse.task_id)
    console.log('💬 メッセージ:', submissionResponse.message)
    console.groupEnd()

    // タスクの完了を待つ
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))
      
      try {
        const taskStatus = await getTaskStatus(submissionResponse.task_id)
        
        const progress = Math.round(((attempt + 1) / maxAttempts) * 100)
        const remainingTime = Math.round((maxAttempts - attempt - 1) * pollInterval / 1000)
        
        console.group('🔄 タスクステータス確認')
        console.log(`📊 進行状況: ${progress}% (${attempt + 1}/${maxAttempts})`)
        console.log(`⏱️ 残り時間: 約${remainingTime}秒`)
        console.log(`🎯 タスクステータス: ${taskStatus.status}`)
        console.log(`🆔 タスクID: ${submissionResponse.task_id}`)
        console.log(`⏰ タイムスタンプ: ${new Date().toISOString()}`)
        console.groupEnd()
        
        if (taskStatus.status === 'SUCCESS') {
          console.group('✅ フォーム送信完了')
          console.log(`⏱️ 所要時間: ${Math.round((attempt + 1) * pollInterval / 1000)}秒`)
          console.log(`🎯 試行回数: ${attempt + 1}/${maxAttempts}`)
          console.log(`⏰ 完了時刻: ${new Date().toISOString()}`)
          console.log('📋 結果:', taskStatus.result)
          console.groupEnd()
          
          return {
            success: true,
            result: taskStatus.result,
            task_id: submissionResponse.task_id
          }
        } else if (taskStatus.status === 'FAILURE') {
          console.group('❌ フォーム送信失敗')
          console.log(`⏱️ 経過時間: ${Math.round((attempt + 1) * pollInterval / 1000)}秒`)
          console.log(`🎯 試行回数: ${attempt + 1}/${maxAttempts}`)
          console.log(`⏰ 失敗時刻: ${new Date().toISOString()}`)
          console.log('❗ エラー情報:', taskStatus.result)
          if (taskStatus.traceback) {
            console.log('🔍 トレースバック:', taskStatus.traceback)
          }
          console.groupEnd()
          
          return {
            success: false,
            error: taskStatus.result?.error || 'タスクが失敗しました',
            task_id: submissionResponse.task_id
          }
        }
        // PENDING, PROGRESS の場合は続行
      } catch (error) {
        // タスクステータス取得失敗は続行
        console.group('⚠️ タスクステータス取得エラー')
        console.log(`📊 進行状況: ${Math.round(((attempt + 1) / maxAttempts) * 100)}%`)
        console.log(`🆔 タスクID: ${submissionResponse.task_id}`)
        console.log(`❗ エラー詳細: ${error instanceof Error ? error.message : String(error)}`)
        console.log(`⏰ タイムスタンプ: ${new Date().toISOString()}`)
        console.groupEnd()
      }
    }
    
    const totalTimeSeconds = Math.round((maxAttempts * pollInterval) / 1000)
    
    console.group('⏰ フォーム送信タイムアウト')
    console.log(`⌛ 経過時間: ${totalTimeSeconds}秒`)
    console.log(`🎯 試行回数: ${maxAttempts}回`)
    console.log(`🆔 タスクID: ${submissionResponse.task_id}`)
    console.log(`⏰ タイムアウト時刻: ${new Date().toISOString()}`)
    console.log('💡 対処方法:')
    console.log('  • 「再試行」ボタンをクリック')
    console.log('  • 時間をおいてから再実行')
    console.log('  • タスクキューの状態確認')
    console.groupEnd()
    
    return {
      success: false,
      error: `フォーム送信がタイムアウトしました（${totalTimeSeconds}秒経過）。\n\n考えられる原因：\n• サーバーの負荷が高い\n• フォーム送信処理に時間がかかっている\n• ネットワーク接続の問題\n\nタスクID: ${submissionResponse.task_id}`,
      task_id: submissionResponse.task_id
    }

  } catch (error) {
    console.group('❌ フォーム送信開始エラー')
    console.log(`⏰ エラー発生時刻: ${new Date().toISOString()}`)
    console.log(`❗ エラー詳細: ${error instanceof Error ? error.message : String(error)}`)
    console.groupEnd()
    
    throw error
  }
}

/**
 * ドライラン用の簡単な関数
 */
export const dryRunFormSubmission = async (
  formId: number,
  templateId: number,
  templateData: Record<string, any>
): Promise<{
  success: boolean
  result?: any
  error?: string
}> => {
  try {
    const result = await submitFormAndWaitForResult({
      form_id: formId,
      template_id: templateId,
      template_data: templateData,
      take_screenshot: true,
      dry_run: true
    })
    
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * 実際のフォーム送信用の関数
 */
export const actualFormSubmission = async (
  formId: number,
  templateId: number,
  templateData: Record<string, any>
): Promise<{
  success: boolean
  result?: any
  error?: string
}> => {
  try {
    const result = await submitFormAndWaitForResult({
      form_id: formId,
      template_id: templateId,
      template_data: templateData,
      take_screenshot: true,
      dry_run: false
    })
    
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}