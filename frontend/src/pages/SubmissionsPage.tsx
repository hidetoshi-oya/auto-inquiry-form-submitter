import { useState, useEffect } from 'react'
import { SubmissionsTable } from '../components/submissions/SubmissionsTable'
import { SubmissionModal } from '../components/submissions/SubmissionModal'
import { SubmissionsFilter } from '../components/submissions/SubmissionsFilter'
import { SubmissionsStats } from '../components/submissions/SubmissionsStats'
import { ExportButton } from '../components/submissions/ExportButton'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { EmptyState } from '../components/ui/EmptyState'
import { Pagination } from '../components/ui/Pagination'
import { Submission, Company, Template } from '../types/models'

interface SubmissionsPageState {
  submissions: Submission[]
  companies: Company[]
  templates: Template[]
  total: number
  page: number
  loading: boolean
  error: string | null
  selectedSubmissionId: string | null
  isModalOpen: boolean
}

interface SubmissionFilters {
  status: string
  companyId: number | string
  templateId: string
  dateFrom: string
  dateTo: string
  search: string
}

export function SubmissionsPage() {
  const [state, setState] = useState<SubmissionsPageState>({
    submissions: [],
    companies: [],
    templates: [],
    total: 0,
    page: 1,
    loading: true,
    error: null,
    selectedSubmissionId: null,
    isModalOpen: false
  })

  const [filters, setFilters] = useState<SubmissionFilters>({
    status: 'all',
    companyId: '',
    templateId: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  })

  const perPage = 20

  // 初期データと送信履歴の取得
  useEffect(() => {
    let ignore = false

    const fetchData = async () => {
      setState(prev => ({ ...prev, loading: true, error: null }))

      try {
        const [submissionsData, companiesData, templatesData] = await Promise.all([
          fetchSubmissions(state.page, perPage, filters),
          fetchCompanies(),
          fetchTemplates()
        ])

        if (!ignore) {
          setState(prev => ({
            ...prev,
            submissions: submissionsData.submissions,
            total: submissionsData.total,
            companies: companiesData,
            templates: templatesData,
            loading: false
          }))
        }
      } catch (error) {
        if (!ignore) {
          setState(prev => ({
            ...prev,
            error: 'データの取得に失敗しました',
            loading: false
          }))
        }
      }
    }

    fetchData()

    return () => {
      ignore = true
    }
  }, [state.page, filters])

  // フィルター変更時のハンドラー
  const handleFilterChange = (newFilters: Partial<SubmissionFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setState(prev => ({ ...prev, page: 1 })) // ページを1にリセット
  }

  // ページ変更
  const handlePageChange = (newPage: number) => {
    setState(prev => ({ ...prev, page: newPage }))
  }

  // 送信詳細表示
  const handleViewSubmission = (submissionId: string) => {
    setState(prev => ({ 
      ...prev, 
      selectedSubmissionId: submissionId,
      isModalOpen: true 
    }))
  }

  // モーダルを閉じる
  const handleCloseModal = () => {
    setState(prev => ({ 
      ...prev, 
      selectedSubmissionId: null,
      isModalOpen: false 
    }))
  }

  // 送信を削除
  const handleDeleteSubmission = async (submissionId: string) => {
    if (!confirm('この送信履歴を削除してもよろしいですか？')) {
      return
    }

    try {
      await deleteSubmission(submissionId)
      
      setState(prev => ({
        ...prev,
        submissions: prev.submissions.filter(s => s.id !== submissionId),
        total: prev.total - 1
      }))
    } catch (error) {
      alert('削除に失敗しました')
    }
  }

  // データリフレッシュ
  const handleRefresh = () => {
    setState(prev => ({ ...prev, page: 1 }))
    // useEffectが再実行される
  }

  const selectedSubmission = state.submissions.find(s => s.id === state.selectedSubmissionId)
  const totalPages = Math.ceil(state.total / perPage)

  if (state.loading && state.submissions.length === 0) {
    return <LoadingSpinner message="送信履歴を読み込み中..." />
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">送信履歴</h1>
          <p className="text-gray-600 mt-1">フォーム送信の履歴とステータスを管理します</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <ExportButton
            submissions={state.submissions}
            filters={filters}
            total={state.total}
            disabled={state.loading || state.submissions.length === 0}
          />
          
          <button
            onClick={handleRefresh}
            disabled={state.loading}
            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 
                       disabled:opacity-50 disabled:cursor-not-allowed font-medium py-2 px-4 
                       rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            <svg 
              className={`w-4 h-4 ${state.loading ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
            更新
          </button>
        </div>
      </div>

      {/* エラー表示 */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700">{state.error}</p>
          </div>
        </div>
      )}

      {/* 統計情報 */}
      <SubmissionsStats
        submissions={state.submissions}
        total={state.total}
        loading={state.loading}
      />

      {/* フィルター */}
      <SubmissionsFilter
        filters={filters}
        companies={state.companies}
        templates={state.templates}
        onFilterChange={handleFilterChange}
        loading={state.loading}
      />

      {/* 送信履歴テーブル */}
      {state.submissions.length === 0 && !state.loading ? (
        <EmptyState
          title="送信履歴がありません"
          description="フォーム送信を実行すると、ここに履歴が表示されます"
          icon={
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
      ) : (
        <>
          {/* 結果サマリー */}
          <div className="flex justify-between items-center text-sm text-gray-600">
            <p>
              {state.total}件中 {Math.min((state.page - 1) * perPage + 1, state.total)} - {Math.min(state.page * perPage, state.total)}件を表示
            </p>
            {state.loading && (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span>更新中...</span>
              </div>
            )}
          </div>

          <SubmissionsTable
            submissions={state.submissions}
            companies={state.companies}
            templates={state.templates}
            onView={handleViewSubmission}
            onDelete={handleDeleteSubmission}
            loading={state.loading}
          />

          {/* ページネーション */}
          {totalPages > 1 && (
            <Pagination
              currentPage={state.page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              showTotal={true}
              total={state.total}
              perPage={perPage}
            />
          )}
        </>
      )}

      {/* 送信詳細モーダル */}
      <SubmissionModal
        isOpen={state.isModalOpen}
        submission={selectedSubmission}
        company={selectedSubmission ? state.companies.find(c => c.id === selectedSubmission.companyId) : undefined}
        template={selectedSubmission ? state.templates.find(t => t.id === selectedSubmission.templateId) : undefined}
        onClose={handleCloseModal}
      />
    </div>
  )
}

// モックAPI関数
async function fetchSubmissions(
  page: number, 
  perPage: number, 
  filters: SubmissionFilters
): Promise<{ submissions: Submission[], total: number }> {
  await new Promise(resolve => setTimeout(resolve, 800))
  
  // モックデータ
  const allSubmissions: Submission[] = [
    {
      id: '1',
      companyId: 1,
      templateId: '1',
      status: 'success',
      submittedData: {
        name: '営業担当者',
        email: 'sales@example.com',
        company: '株式会社テクノロジーソリューション',
        message: 'お世話になります。弊社サービスについてご案内させていただきたく、ご連絡いたしました。'
      },
      response: 'お問い合わせありがとうございます。担当者より折り返しご連絡いたします。',
      submittedAt: new Date('2025-01-25T14:30:00Z'),
      screenshotUrl: 'https://example.com/screenshots/submission-1.png'
    },
    {
      id: '2',
      companyId: 2,
      templateId: '2',
      status: 'failed',
      submittedData: {
        name: 'ビジネス開発担当',
        email: 'bizdev@example.com',
        company: 'グローバル商事株式会社',
        message: '貴社との協業について提案がございます。'
      },
      errorMessage: 'CAPTCHA認証が必要です。手動での確認をお願いします。',
      submittedAt: new Date('2025-01-25T13:15:00Z')
    },
    {
      id: '3',
      companyId: 1,
      templateId: '1',
      status: 'pending',
      submittedData: {
        name: '営業担当者',
        email: 'sales@example.com',
        company: '株式会社テクノロジーソリューション',
        message: 'フォローアップのご連絡です。'
      },
      submittedAt: new Date('2025-01-25T12:00:00Z')
    },
    {
      id: '4',
      companyId: 3,
      templateId: '1',
      status: 'captcha_required',
      submittedData: {
        name: '営業担当者',
        email: 'sales@example.com',
        message: 'サービス紹介について'
      },
      errorMessage: 'CAPTCHA認証待ちです。',
      submittedAt: new Date('2025-01-25T11:45:00Z')
    }
  ]

  // フィルタリング
  let filteredSubmissions = allSubmissions.filter(submission => {
    const matchesStatus = filters.status === 'all' || submission.status === filters.status
    const matchesCompany = !filters.companyId || submission.companyId === filters.companyId
    const matchesTemplate = !filters.templateId || submission.templateId === filters.templateId
    
    const submissionDate = new Date(submission.submittedAt)
    const matchesDateFrom = !filters.dateFrom || submissionDate >= new Date(filters.dateFrom)
    const matchesDateTo = !filters.dateTo || submissionDate <= new Date(filters.dateTo + 'T23:59:59')
    
    const matchesSearch = !filters.search || 
      JSON.stringify(submission.submittedData).toLowerCase().includes(filters.search.toLowerCase()) ||
      (submission.errorMessage && submission.errorMessage.toLowerCase().includes(filters.search.toLowerCase()))
    
    return matchesStatus && matchesCompany && matchesTemplate && 
           matchesDateFrom && matchesDateTo && matchesSearch
  })

  // ページネーション
  const startIndex = (page - 1) * perPage
  const endIndex = startIndex + perPage
  const paginatedSubmissions = filteredSubmissions.slice(startIndex, endIndex)

  return {
    submissions: paginatedSubmissions,
    total: filteredSubmissions.length
  }
}

async function fetchCompanies(): Promise<Company[]> {
  await new Promise(resolve => setTimeout(resolve, 200))
  
  return [
    {
      id: 1,
      name: '株式会社テクノロジーソリューション',
      url: 'https://techsol.example.com',
      status: 'active',
      memo: 'ITコンサルティング企業',
      meta_data: {},
      createdAt: new Date('2025-01-15T09:00:00Z'),
      updatedAt: new Date('2025-01-20T10:30:00Z'),
      lastSubmittedAt: new Date('2025-01-25T14:30:00Z')
    },
    {
      id: 2,
      name: 'グローバル商事株式会社',
      url: 'https://global-trade.example.com',
      status: 'active',
      memo: '国際貿易・商社',
      meta_data: {},
      createdAt: new Date('2025-01-10T14:20:00Z'),
      updatedAt: new Date('2025-01-18T16:45:00Z')
    },
    {
      id: 3,
      name: '株式会社イノベーション・ラボ',
      url: 'https://innovation-lab.example.com',
      status: 'inactive',
      memo: 'スタートアップ支援',
      meta_data: {},
      createdAt: new Date('2025-01-05T11:15:00Z'),
      updatedAt: new Date('2025-01-15T09:20:00Z')
    }
  ]
}

async function fetchTemplates(): Promise<Template[]> {
  await new Promise(resolve => setTimeout(resolve, 100))
  
  return [
    {
      id: '1',
      name: '営業問い合わせテンプレート',
      category: '営業',
      fields: [],
      variables: [],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      name: 'パートナーシップ提案テンプレート',
      category: '提携',
      fields: [],
      variables: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]
}

async function deleteSubmission(_submissionId: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // 実際のAPIでは DELETE /api/submissions/:id を呼び出し
} 