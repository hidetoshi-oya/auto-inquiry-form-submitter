import { api } from './api'
import {
  CreateCompanyRequest,
  UpdateCompanyRequest,
  CompanyListParams,
  PaginatedResponse,
} from '../types/api'
import { Company } from '../types/models'

/**
 * 企業API関数群
 * バックエンドの /companies エンドポイントと連携
 */

/**
 * 企業一覧を取得
 * 注: バックエンドは現在ページネーション、フィルタリング、ソートを実装していないため、
 * 全件取得してフロントエンドで処理を行う
 */
export const getCompaniesList = async (
  params?: CompanyListParams
): Promise<PaginatedResponse<Company>> => {
  // 企業一覧を全件取得
  const allCompanies = await api.get<Company[]>('/companies/')
  
  // フィルタリング
  let filteredCompanies = [...allCompanies]
  
  // 検索フィルター
  if (params?.search) {
    const searchTerm = params.search.toLowerCase()
    filteredCompanies = filteredCompanies.filter(company => 
      company.name.toLowerCase().includes(searchTerm) ||
      company.url.toLowerCase().includes(searchTerm) ||
      (company.memo && company.memo.toLowerCase().includes(searchTerm))
    )
  }
  
  // ステータスフィルター
  if (params?.status) {
    filteredCompanies = filteredCompanies.filter(company => 
      company.status === params.status
    )
  }
  
  // ソート
  if (params?.sortBy) {
    filteredCompanies.sort((a, b) => {
      const multiplier = params.sortOrder === 'desc' ? -1 : 1
      
      switch (params.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name) * multiplier
        case 'createdAt':
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * multiplier
        case 'lastSubmittedAt':
          const aTime = a.lastSubmittedAt ? new Date(a.lastSubmittedAt).getTime() : 0
          const bTime = b.lastSubmittedAt ? new Date(b.lastSubmittedAt).getTime() : 0
          return (aTime - bTime) * multiplier
        default:
          return 0
      }
    })
  }
  
  // ページネーション処理
  const page = params?.page || 1
  const pageSize = params?.pageSize || 20
  const total = filteredCompanies.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const items = filteredCompanies.slice(startIndex, endIndex)
  
  return {
    items,
    total,
    page,
    per_page: pageSize,
    pages: Math.ceil(total / pageSize),
  }
}

/**
 * 企業詳細を取得
 */
export const getCompany = async (companyId: number): Promise<Company> => {
  return await api.get<Company>(`/companies/${companyId}`)
}

/**
 * 新規企業を作成
 */
export const createCompany = async (
  companyData: CreateCompanyRequest
): Promise<Company> => {
  return await api.post<Company>('/companies/', companyData)
}

/**
 * 企業情報を更新
 */
export const updateCompany = async (
  companyId: number,
  companyData: UpdateCompanyRequest
): Promise<Company> => {
  return await api.put<Company>(`/companies/${companyId}`, companyData)
}

/**
 * 企業を削除
 */
export const deleteCompany = async (companyId: number): Promise<Company> => {
  return await api.delete<Company>(`/companies/${companyId}`)
}

/**
 * 企業のステータス別カウントを取得（将来的な拡張用）
 */
export const getCompanyStats = async (): Promise<{
  active: number
  inactive: number
  blocked: number
  total: number
}> => {
  // 現在はフロントエンドで集計
  const companies = await getCompaniesList({ pageSize: 1000 })
  
  const stats = {
    active: 0,
    inactive: 0,
    blocked: 0,
    total: companies.total,
  }
  
  companies.items.forEach((company) => {
    stats[company.status]++
  })
  
  return stats
}