import axios, { AxiosResponse, AxiosError, AxiosRequestConfig } from 'axios'
import { ApiError, PaginatedResponse } from '../types/api'

// snake_caseをcamelCaseに変換するユーティリティ
const toCamelCase = (str: string): string => {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

// オブジェクトのキーをsnake_caseからcamelCaseに変換
const convertKeysToCamelCase = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase)
  }
  
  const converted: any = {}
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const camelKey = toCamelCase(key)
      const value = obj[key]
      
      // Date文字列をDateオブジェクトに変換
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        converted[camelKey] = new Date(value)
      } else {
        converted[camelKey] = convertKeysToCamelCase(value)
      }
    }
  }
  
  return converted
}

// APIクライアントのベースURL設定
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

// 開発環境でのみデバッグログを出力
if (import.meta.env.DEV) {
  console.log('🔧 BASE_URL設定:', BASE_URL)
  console.log('🌍 Environment:', import.meta.env.MODE)
  console.log('🔧 VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL)
}

// BASE_URLが不正でないかチェック
if (BASE_URL && !BASE_URL.startsWith('/') && !BASE_URL.startsWith('http')) {
  console.error('❌ 不正なBASE_URL:', BASE_URL)
  throw new Error(`Invalid BASE_URL: ${BASE_URL}`)
}

// 開発環境でのAPIログ設定
if (import.meta.env.DEV) {
  console.log('🔧 API Logger initialized for development')
}

// axiosインスタンスを作成
// 相対パスの場合はbaseURLを設定せず、Viteのプロキシに任せる
const isRelativePath = BASE_URL.startsWith('/')

let axiosConfig: any = {
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
}

// baseURLが相対パスでない場合のみ設定
if (!isRelativePath) {
  try {
    // URL の妥当性をチェック
    new URL(BASE_URL)
    axiosConfig.baseURL = BASE_URL
  } catch (error) {
    console.error('❌ 無効なbaseURL:', BASE_URL, error)
    // フォールバック: baseURLを設定しない（相対パスとして扱う）
  }
}

if (import.meta.env.DEV) {
  console.log('🔧 Axios設定:', axiosConfig)
  console.log('🔧 相対パス判定:', isRelativePath)
}

const apiClient = axios.create(axiosConfig)

// リクエストインターセプター - 認証トークンの自動追加とログ出力
apiClient.interceptors.request.use(
  (config) => {
    // ローカルストレージからトークンを取得
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // 開発環境でのリクエストログ
    if (import.meta.env.DEV) {
      const prefix = config.url?.includes('/forms/') ? '[FORMS-API-REQUEST]' : '[API-REQUEST]'
      console.log(`${prefix} ${config.method?.toUpperCase()} ${config.url}`)
      
      if (config.url?.includes('/forms/company')) {
        console.group('📤 /forms/company Request Details')
        console.log('🔗 Company ID:', config.url.match(/\/forms\/company\/(\d+)/)?.[1])
        console.log('⏰ Timestamp:', new Date().toISOString())
        console.groupEnd()
      }
    }
    
    return config
  },
  (error) => {
    // エラーログ出力
    if (import.meta.env.DEV) {
      console.group('❌ API Request Error')
      console.error(error)
      console.groupEnd()
    }
    return Promise.reject(error)
  }
)

// レスポンスインターセプター - エラーハンドリングとsnake_case→camelCase変換
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // レスポンスデータをcamelCaseに変換
    response.data = convertKeysToCamelCase(response.data)
    
    // 開発環境でのレスポンスログ
    if (import.meta.env.DEV) {
      const prefix = response.config.url?.includes('/forms/') ? '[FORMS-API-RESPONSE]' : '[API-RESPONSE]'
      console.log(`${prefix} ${response.status} ${response.config.url}`)
      
      if (response.config.url?.includes('/forms/company')) {
        console.group('📥 /forms/company Response Details')
        console.log('📊 Response Data Length:', Array.isArray(response.data) ? response.data.length : 'Not an array')
        console.log('⏰ Timestamp:', new Date().toISOString())
        if (Array.isArray(response.data) && response.data.length > 0) {
          console.log('🔍 First Form Preview:', response.data[0])
        }
        console.groupEnd()
      } else if (response.config.url?.includes('/forms/detect')) {
        console.group('📥 Forms Detection Response')
        console.log('🎯 Detection Status:', response.data?.status)
        console.log('🆔 Task ID:', response.data?.taskId)
        console.log('🏢 Company ID:', response.data?.companyId)
        console.groupEnd()
      }
    }
    
    return response
  },
  (error: AxiosError<ApiError>) => {
    // 開発環境でのエラーログ
    if (import.meta.env.DEV) {
      if (error.config?.url?.includes('/forms/company')) {
        console.group('💥 /forms/company Error Details')
        console.error('🔗 Failed URL:', error.config?.url)
        console.error('📊 Status Code:', error.response?.status)
        console.error('📝 Error Detail:', error.response?.data?.detail)
        console.error('⏰ Timestamp:', new Date().toISOString())
        console.groupEnd()
      } else {
        console.group('💥 API Error')
        console.error(error)
        console.groupEnd()
      }
    }
    
    // 401エラー（認証失敗）の場合はトークンを削除してログインページにリダイレクト
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    
    // エラーメッセージを統一形式で返す
    const errorMessage = error.response?.data?.detail || error.message || 'An unexpected error occurred'
    
    return Promise.reject({
      message: errorMessage,
      status: error.response?.status,
      data: error.response?.data,
    })
  }
)

// URLを正規化する関数
const normalizeUrl = (url: string): string => {
  let normalizedUrl = url
  
  if (isRelativePath) {
    // 相対パスの場合、BASE_URLをプレフィックスとして追加
    if (url.startsWith('/')) {
      normalizedUrl = `${BASE_URL}${url}`
    } else {
      normalizedUrl = `${BASE_URL}/${url}`
    }
  }
  
  if (import.meta.env.DEV) {
    console.log(`🔗 URL正規化: ${url} → ${normalizedUrl}`)
  }
  return normalizedUrl
}

// 基本的なHTTPメソッドのヘルパー関数
export const api = {
  get: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const normalizedUrl = normalizeUrl(url)
    const response = await apiClient.get<T>(normalizedUrl, config)
    return response.data
  },

  post: async <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    const normalizedUrl = normalizeUrl(url)
    const response = await apiClient.post<T>(normalizedUrl, data, config)
    return response.data
  },

  put: async <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    const normalizedUrl = normalizeUrl(url)
    const response = await apiClient.put<T>(normalizedUrl, data, config)
    return response.data
  },

  delete: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const normalizedUrl = normalizeUrl(url)
    const response = await apiClient.delete<T>(normalizedUrl, config)
    return response.data
  },

  patch: async <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    const normalizedUrl = normalizeUrl(url)
    const response = await apiClient.patch<T>(normalizedUrl, data, config)
    return response.data
  },
}

// ページネーション対応のGETリクエスト用ヘルパー
export const paginatedGet = async <T>(
  url: string,
  params?: Record<string, any>
): Promise<PaginatedResponse<T>> => {
  const normalizedUrl = normalizeUrl(url)
  const response = await apiClient.get<PaginatedResponse<T>>(normalizedUrl, { params })
  return response.data
}

export default apiClient