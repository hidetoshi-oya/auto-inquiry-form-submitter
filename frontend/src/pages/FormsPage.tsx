import { useState, useEffect } from 'react'
import { FormDetectionPanel } from '../components/forms/FormDetectionPanel'
import { FormSubmissionPanel } from '../components/forms/FormSubmissionPanel'
import { DetectedFormsList } from '../components/forms/DetectedFormsList'
import { FormProgressTracker } from '../components/forms/FormProgressTracker'
import { TaskStatusMonitor } from '../components/tasks/TaskStatusMonitor'
import { Company, Form, Template, TaskStatus } from '../types/models'
import { getCompaniesList } from '../services/companies'
import { startFormDetection, getCompanyForms } from '../services/forms'
import { templatesApi, Template as BackendTemplate, TemplateField as BackendTemplateField, TemplateVariable as BackendTemplateVariable } from '../services/templates'
import { actualFormSubmission, dryRunFormSubmission } from '../services/submissions'

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

// バックエンドTemplateをフロントエンドTemplate型に変換
function convertBackendTemplate(backendTemplate: BackendTemplate): Template {
  console.log('🔄 convertBackendTemplate開始:', {
    backendTemplateId: backendTemplate?.id,
    name: backendTemplate?.name,
    category: backendTemplate?.category,
    fieldsCount: backendTemplate?.fields?.length || 0,
    variablesCount: backendTemplate?.variables?.length || 0,
    rawBackendTemplate: backendTemplate
  });

  // 必須フィールドの検証
  if (!backendTemplate) {
    throw new Error('バックエンドテンプレートがnullまたはundefinedです');
  }

  if (typeof backendTemplate.id === 'undefined' || backendTemplate.id === null) {
    throw new Error(`テンプレートIDが無効です: ${backendTemplate.id}`);
  }

  if (!backendTemplate.name || typeof backendTemplate.name !== 'string') {
    throw new Error(`テンプレート名が無効です: ${backendTemplate.name}`);
  }

  if (!backendTemplate.category || typeof backendTemplate.category !== 'string') {
    throw new Error(`テンプレートカテゴリが無効です: ${backendTemplate.category}`);
  }

  try {
    const converted: Template = {
      id: String(backendTemplate.id), // より明示的にString()を使用
      name: backendTemplate.name,
      category: backendTemplate.category,
      fields: (backendTemplate.fields || []).map((field: BackendTemplateField) => ({
        key: field.key || '',
        value: field.value || '',
        type: (field.field_type as 'static' | 'variable') || 'static' // 型アサーション
      })),
      variables: (backendTemplate.variables || []).map((variable: BackendTemplateVariable) => ({
        name: variable.name || '',
        key: variable.key || '',
        defaultValue: variable.default_value || '' // snake_caseのみサポート
      })),
      createdAt: new Date(backendTemplate.created_at || Date.now()),
      updatedAt: new Date(backendTemplate.updated_at || Date.now())
    };

    console.log('✅ convertBackendTemplate完了:', {
      originalId: backendTemplate.id,
      originalIdType: typeof backendTemplate.id,
      convertedId: converted.id,
      convertedIdType: typeof converted.id,
      name: converted.name,
      category: converted.category,
      fieldsCount: converted.fields.length,
      variablesCount: converted.variables.length,
      convertedTemplate: converted
    });

    return converted;
  } catch (error) {
    console.error('❌ convertBackendTemplateエラー:', {
      error,
      backendTemplate,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw new Error(`テンプレート変換エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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

    console.log('🚀 FormsPage初期化開始', {
      hasAccessToken: !!localStorage.getItem('access_token'),
      timestamp: new Date().toISOString()
    });

    const fetchInitialData = async () => {
      try {
        console.log('🔄 初期データ取得開始');

        // 実際のAPIから企業一覧とテンプレート一覧を取得
        const [companiesResponse, templatesData] = await Promise.all([
          getCompaniesList().catch(error => {
            console.error('❌ Companies API error:', error)
            return { items: [] }
          }),
          templatesApi.getTemplates().catch(error => {
            console.error('❌ Templates API error:', {
              error,
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined
            })
            return []
          })
        ])

        console.log('📥 API レスポンス受信:', {
          companiesCount: companiesResponse?.items?.length || 0,
          templatesDataType: typeof templatesData,
          templatesIsArray: Array.isArray(templatesData),
          templatesCount: Array.isArray(templatesData) ? templatesData.length : 'N/A',
          rawTemplatesData: templatesData
        });

        if (!ignore) {
          // テンプレートデータの変換
          let convertedTemplates: Template[] = [];
          if (Array.isArray(templatesData) && templatesData.length > 0) {
            console.log('🔄 テンプレートデータ変換開始:', templatesData.length, '件');
            try {
              convertedTemplates = templatesData.map((template, index) => {
                console.log(`🔄 テンプレート変換 ${index + 1}/${templatesData.length}:`, template);
                return convertBackendTemplate(template);
              });
              console.log('✅ テンプレートデータ変換完了:', convertedTemplates.length, '件');
            } catch (conversionError) {
              console.error('❌ テンプレート変換エラー:', conversionError);
              convertedTemplates = [];
            }
          } else {
            console.log('⚠️ テンプレートデータが空または無効:', templatesData);
          }

          console.log('📝 状態更新:', {
            companiesCount: companiesResponse.items?.length || 0,
            templatesCount: convertedTemplates.length,
            convertedTemplates
          });

          setState(prev => ({
            ...prev,
            companies: companiesResponse.items || [],
            templates: convertedTemplates
          }))

          console.log('✅ 初期データ取得・設定完了');
        }
      } catch (error) {
        console.error('❌ 初期データ取得エラー:', {
          error,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });

        if (!ignore) {
          let errorMessage = 'データの取得に失敗しました';
          
          if (error && typeof error === 'object' && 'message' in error) {
            const errorMsg = (error as Error).message;
            if (errorMsg.includes('401') || errorMsg.includes('認証')) {
              errorMessage = '認証エラー：ログインし直してください';
            } else if (errorMsg.includes('403') || errorMsg.includes('権限')) {
              errorMessage = '権限エラー：テンプレートにアクセスする権限がありません';
            } else if (errorMsg.includes('Network Error') || errorMsg.includes('fetch')) {
              errorMessage = 'ネットワークエラー：サーバーに接続できません';
            } else if (errorMsg.includes('テンプレート変換エラー')) {
              errorMessage = 'テンプレートデータの処理中にエラーが発生しました';
            } else {
              errorMessage = `エラー: ${errorMsg}`;
            }
          }

          setState(prev => ({
            ...prev,
            error: errorMessage,
            companies: [],
            templates: []
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
      // 実際のAPIコール
      const result = dryRun 
        ? await dryRunFormSubmission(parseInt(formId), parseInt(templateId), templateData)
        : await actualFormSubmission(parseInt(formId), parseInt(templateId), templateData)
      
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
        error: error instanceof Error ? error.message : 'フォーム送信に失敗しました'
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