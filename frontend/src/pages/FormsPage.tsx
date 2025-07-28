import { useState, useEffect } from 'react'
import { FormDetectionPanel } from '../components/forms/FormDetectionPanel'
import { FormSubmissionPanel } from '../components/forms/FormSubmissionPanel'
import { DetectedFormsList } from '../components/forms/DetectedFormsList'
import { FormProgressTracker } from '../components/forms/FormProgressTracker'
import { TaskStatusMonitor } from '../components/tasks/TaskStatusMonitor'
import { Company, Form, Template, TaskStatus } from '../types/models'
import { getCompaniesList } from '../services/companies'
import { startFormDetection, getCompanyForms } from '../services/forms'

interface FormsPageState {
  companies: Company[]
  templates: Template[]
  selectedCompanyId: number | null
  detectedForms: Form[]
  selectedFormId: string | null
  isDetecting: boolean
  isSubmitting: boolean
  submissionStatus: 'idle' | 'processing' | 'success' | 'error'
  error: string | null
  detectionTaskId: string | null
  detectionTaskStatus: TaskStatus | null
}

export function FormsPage() {
  const [state, setState] = useState<FormsPageState>({
    companies: [],
    templates: [],
    selectedCompanyId: null,
    detectedForms: [],
    selectedFormId: null,
    isDetecting: false,
    isSubmitting: false,
    submissionStatus: 'idle',
    error: null,
    detectionTaskId: null,
    detectionTaskStatus: null
  })

  // 初期データの取得
  useEffect(() => {
    let ignore = false

    const fetchInitialData = async () => {
      try {
        // 実際のAPIから企業一覧とテンプレート一覧を取得
        const [companiesResponse, templatesData] = await Promise.all([
          getCompaniesList(),
          fetchTemplates()
        ])

        if (!ignore) {
          setState(prev => ({
            ...prev,
            companies: companiesResponse.items,
            templates: templatesData
          }))
        }
      } catch (error) {
        if (!ignore) {
          setState(prev => ({
            ...prev,
            error: 'データの取得に失敗しました'
          }))
        }
      }
    }

    fetchInitialData()

    return () => {
      ignore = true
    }
  }, [])

  // フォーム検出の実行
  const handleFormDetection = async (companyId: number, forceRefresh: boolean = false) => {
    setState(prev => ({ 
      ...prev, 
      selectedCompanyId: companyId, 
      isDetecting: true, 
      error: null,
      detectedForms: [],
      selectedFormId: null,
      detectionTaskId: null,
      detectionTaskStatus: null
    }))

    try {
      // タスクベースのフォーム検出を開始
      const detectionResponse = await startFormDetection({
        company_id: companyId,
        force_refresh: forceRefresh
      })
      
      if (detectionResponse.status === 'existing') {
        // 既存のフォームがある場合は即座に取得
        const existingForms = await getCompanyForms(companyId)
        setState(prev => ({
          ...prev,
          detectedForms: existingForms,
          isDetecting: false
        }))
      } else if (detectionResponse.status === 'processing') {
        // タスクが開始された場合は、タスクIDを保存して監視開始
        setState(prev => ({
          ...prev,
          detectionTaskId: detectionResponse.task_id,
          detectionTaskStatus: 'PENDING'
        }))
      }
    } catch (error) {
      console.error('フォーム検出エラー:', error)
      setState(prev => ({
        ...prev,
        isDetecting: false,
        error: error instanceof Error ? error.message : 'フォーム検出に失敗しました'
      }))
    }
  }

  // タスク状態変更時のハンドラー
  const handleTaskStatusChange = (taskStatus: TaskStatus, taskData: any) => {
    setState(prev => ({
      ...prev,
      detectionTaskStatus: taskStatus
    }))

    // タスクが完了した場合は、フォーム一覧を取得
    if (taskStatus === 'SUCCESS' && state.selectedCompanyId) {
      loadDetectedForms(state.selectedCompanyId)
    } else if (taskStatus === 'FAILURE') {
      setState(prev => ({
        ...prev,
        isDetecting: false,
        error: 'フォーム検出タスクが失敗しました'
      }))
    }
  }

  // タスク完了時のハンドラー
  const handleTaskComplete = async (result: any) => {
    if (state.selectedCompanyId) {
      await loadDetectedForms(state.selectedCompanyId)
    }
    setState(prev => ({
      ...prev,
      isDetecting: false
    }))
  }

  // タスクエラー時のハンドラー
  const handleTaskError = (error: string) => {
    setState(prev => ({
      ...prev,
      isDetecting: false,
      error: `フォーム検出エラー: ${error}`
    }))
  }

  // 検出されたフォームを読み込む
  const loadDetectedForms = async (companyId: number) => {
    try {
      const forms = await getCompanyForms(companyId)
      setState(prev => ({
        ...prev,
        detectedForms: forms,
        isDetecting: false
      }))
    } catch (error) {
      console.error('フォーム取得エラー:', error)
      setState(prev => ({
        ...prev,
        error: 'フォーム一覧の取得に失敗しました'
      }))
    }
  }

  // リトライ実行
  const handleRetry = () => {
    if (state.selectedCompanyId) {
      handleFormDetection(state.selectedCompanyId, true)
    }
  }

  // フォーム送信の実行
  const handleFormSubmission = async (
    formId: string, 
    templateId: string, 
    templateData: Record<string, string>,
    dryRun: boolean = false
  ) => {
    setState(prev => ({ 
      ...prev, 
      selectedFormId: formId,
      isSubmitting: true, 
      submissionStatus: 'processing',
      error: null 
    }))

    try {
      // TODO: 実際のAPIコール
      const result = await submitForm(formId, templateId, templateData, dryRun)
      
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        submissionStatus: result.success ? 'success' : 'error',
                  error: result.success ? null : (result.error || 'エラーが発生しました')
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        submissionStatus: 'error',
        error: 'フォーム送信に失敗しました'
      }))
    }
  }

  // タスクステータスの確認（現在は未使用）
  // const handleTaskStatusCheck = async (taskId: string) => {
  //   try {
  //     const status = await checkTaskStatus(taskId)
  //     
  //     if (status.completed) {
  //       setState(prev => ({
  //         ...prev,
  //         isDetecting: false,
  //         isSubmitting: false,
  //         detectedForms: status.result?.forms || prev.detectedForms,
  //         submissionStatus: status.success ? 'success' : 'error',
  //         error: status.success ? null : (status.error || 'エラーが発生しました')
  //       }))
  //     }
  //   } catch (error) {
  //     console.error('タスクステータス確認エラー:', error)
  //   }
  // }

  const selectedCompany = state.companies.find(c => c.id === state.selectedCompanyId)

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">フォーム検出・送信</h1>
        <p className="text-gray-600 mt-1">企業サイトの問い合わせフォームを検出し、自動送信を行います</p>
      </div>

      {/* エラー表示 */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-red-700 whitespace-pre-line">{state.error}</p>
                {state.error.includes('タイムアウト') && state.selectedCompanyId && (
                  <div className="mt-3 text-sm text-red-600">
                    <p className="mb-2">対処方法：</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>「再試行」ボタンをクリックして再度実行</li>
                      <li>時間をおいてから再度お試しください</li>
                      <li>問題が続く場合は管理者にお問い合わせください</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
            {state.error.includes('タイムアウト') && state.selectedCompanyId && (
              <button
                onClick={handleRetry}
                disabled={state.isDetecting}
                className="ml-4 flex-shrink-0 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {state.isDetecting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    再試行中...
                  </>
                ) : (
                  '再試行'
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* プログレストラッカー */}
      <FormProgressTracker 
        selectedCompany={selectedCompany}
        detectedFormsCount={state.detectedForms.length}
        isDetecting={state.isDetecting}
        isSubmitting={state.isSubmitting}
        submissionStatus={state.submissionStatus}
      />

      {/* タスク状態監視 */}
      {state.detectionTaskId && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">フォーム検出タスク状態</h3>
          <TaskStatusMonitor
            taskId={state.detectionTaskId}
            autoRefresh={true}
            refreshInterval={3000}
            onStatusChange={handleTaskStatusChange}
            onComplete={handleTaskComplete}
            onError={handleTaskError}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* フォーム検出パネル */}
        <FormDetectionPanel
          companies={state.companies}
          selectedCompanyId={state.selectedCompanyId}
          isDetecting={state.isDetecting}
          onDetect={handleFormDetection}
        />

        {/* フォーム送信パネル */}
        <FormSubmissionPanel
          templates={state.templates}
          detectedForms={state.detectedForms}
          selectedFormId={state.selectedFormId}
          isSubmitting={state.isSubmitting}
          submissionStatus={state.submissionStatus}
          onSubmit={handleFormSubmission}
          disabled={state.detectedForms.length === 0}
        />
      </div>

      {/* 検出されたフォーム一覧 */}
      {state.detectedForms.length > 0 && (
        <DetectedFormsList
          forms={state.detectedForms}
          selectedFormId={state.selectedFormId}
                     onFormSelect={(formId: string) => setState(prev => ({ ...prev, selectedFormId: formId }))}
          isSubmitting={state.isSubmitting}
        />
      )}
    </div>
  )
}

// モックAPI関数

async function fetchTemplates(): Promise<Template[]> {
  await new Promise(resolve => setTimeout(resolve, 300))
  
  return [
    {
      id: '1',
      name: '営業問い合わせテンプレート',
      category: '営業',
      fields: [
        { key: 'company_name', value: '{{company_name}}', type: 'variable' },
        { key: 'contact_name', value: '営業担当者', type: 'static' },
        { key: 'email', value: 'sales@example.com', type: 'static' },
        { key: 'message', value: 'お世話になります。弊社サービスについてご案内させていただきたく、ご連絡いたしました。', type: 'static' }
      ],
      variables: [
        { name: '企業名', key: 'company_name', defaultValue: '' }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      name: 'パートナーシップ提案テンプレート',
      category: '提携',
      fields: [
        { key: 'company_name', value: '{{company_name}}', type: 'variable' },
        { key: 'contact_name', value: 'ビジネス開発担当', type: 'static' },
        { key: 'message', value: '貴社との協業について提案がございます。', type: 'static' }
      ],
      variables: [
        { name: '企業名', key: 'company_name', defaultValue: '' }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]
}


async function submitForm(
  formId: string, 
  templateId: string, 
  templateData: Record<string, string>, 
  dryRun: boolean
): Promise<{ success: boolean; error?: string; result?: any }> {
  // シミュレート：送信に1-3秒かかる
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
  
  // 30%の確率で失敗をシミュレート
  if (!dryRun && Math.random() < 0.3) {
    return {
      success: false,
      error: 'CAPTCHA認証が必要です。手動での確認をお願いします。'
    }
  }
  
  return {
    success: true,
    result: {
      formId,
      templateId,
      submittedData: templateData,
      dryRun,
      submittedAt: new Date().toISOString()
    }
  }
}

// 現在未使用のためコメントアウト
// async function checkTaskStatus(_taskId: string): Promise<{
//   completed: boolean
//   success: boolean
//   result?: any
//   error?: string
// }> {
//   await new Promise(resolve => setTimeout(resolve, 500))
//   
//   return {
//     completed: true,
//     success: true,
//     result: { forms: [] }
//   }
// } 