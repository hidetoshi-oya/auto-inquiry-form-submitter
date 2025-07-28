import { useState, useEffect } from 'react'
import { CompanyCard } from '../components/companies/CompanyCard'
import { CompanyModal } from '../components/companies/CompanyModal'
import { SearchAndFilter } from '../components/companies/SearchAndFilter'
import { Pagination } from '../components/ui/Pagination'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { EmptyState } from '../components/ui/EmptyState'
import { Company } from '../types/models'
import { getCompaniesList, deleteCompany } from '../services/companies'
import { CompanyListParams } from '../types/api'

interface CompaniesState {
  companies: Company[]
  total: number
  page: number
  loading: boolean
  error: string | null
}

interface SearchFilters {
  search: string
  status: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export function CompaniesPage() {
  const [state, setState] = useState<CompaniesState>({
    companies: [],
    total: 0,
    page: 1,
    loading: true,
    error: null
  })

  const [filters, setFilters] = useState<SearchFilters>({
    search: '',
    status: 'all',
    sortBy: 'name',
    sortOrder: 'asc'
  })

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')

  const perPage = 20

  // 企業データの取得
  useEffect(() => {
    fetchCompanies()
  }, [state.page, filters])

  const fetchCompanies = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const params: CompanyListParams = {
        page: state.page,
        pageSize: perPage,
        search: filters.search || undefined,
        status: filters.status !== 'all' ? filters.status as any : undefined,
        sortBy: filters.sortBy as any,
        sortOrder: filters.sortOrder,
      }
      
      const response = await getCompaniesList(params)
      
      setState(prev => ({
        ...prev,
        companies: response.items,
        total: response.total,
        loading: false
      }))
    } catch (error: any) {
      console.error('企業データの取得エラー:', error)
      setState(prev => ({
        ...prev,
        error: error.message || 'データの取得に失敗しました',
        loading: false
      }))
    }
  }

  const handleCreateCompany = () => {
    setSelectedCompany(null)
    setModalMode('create')
    setIsModalOpen(true)
  }

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleDeleteCompany = async (companyId: number) => {
    if (!confirm('この企業を削除してもよろしいですか？')) {
      return
    }

    try {
      await deleteCompany(companyId)
      
      setState(prev => ({
        ...prev,
        companies: prev.companies.filter(c => c.id !== companyId),
        total: prev.total - 1
      }))
    } catch (error: any) {
      console.error('企業削除エラー:', error)
      alert(`削除に失敗しました: ${error.message || '不明なエラー'}`)
    }
  }

  const handleCompanySaved = (savedCompany: Company) => {
    if (modalMode === 'create') {
      setState(prev => ({
        ...prev,
        companies: [savedCompany, ...prev.companies],
        total: prev.total + 1
      }))
    } else {
      setState(prev => ({
        ...prev,
        companies: prev.companies.map(c =>
          c.id === savedCompany.id ? savedCompany : c
        )
      }))
    }
    setIsModalOpen(false)
  }

  const handlePageChange = (newPage: number) => {
    setState(prev => ({ ...prev, page: newPage }))
  }

  const handleFilterChange = (newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setState(prev => ({ ...prev, page: 1 })) // ページを1にリセット
  }

  const totalPages = Math.ceil(state.total / perPage)

  if (state.loading && state.companies.length === 0) {
    return <LoadingSpinner message="企業データを読み込み中..." />
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">企業管理</h1>
          <p className="text-gray-600 mt-1">問い合わせ先企業の登録・管理を行います</p>
        </div>
        <button
          onClick={handleCreateCompany}
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg 
                     shadow-sm transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          企業を追加
        </button>
      </div>

      {/* 検索・フィルター */}
      <SearchAndFilter 
        filters={filters}
        onFilterChange={handleFilterChange}
        onRefresh={fetchCompanies}
        loading={state.loading}
      />

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

      {/* 企業リスト */}
      {state.companies.length === 0 && !state.loading ? (
        <EmptyState
          title="企業が登録されていません"
          description="新しい企業を追加して問い合わせフォームの自動送信を開始しましょう"
          actionLabel="企業を追加"
          onAction={handleCreateCompany}
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

          {/* 企業カードグリッド */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {state.companies.map((company) => (
              <CompanyCard
                key={company.id}
                company={company}
                onEdit={handleEditCompany}
                onDelete={handleDeleteCompany}
              />
            ))}
          </div>

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

      {/* 企業作成・編集モーダル */}
      <CompanyModal
        isOpen={isModalOpen}
        mode={modalMode}
        company={selectedCompany}
        onClose={() => setIsModalOpen(false)}
        onSave={handleCompanySaved}
      />
    </div>
  )
}