import axios, { AxiosResponse, AxiosError, AxiosRequestConfig } from 'axios'
import * as AxiosLogger from 'axios-logger'
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

// axios-logger設定
AxiosLogger.setGlobalConfig({
  prefixText: '[API]',
  dateFormat: 'yyyy-mm-dd HH:MM:ss',
  status: true,
  statusText: true,
  headers: true,
  params: true,
  data: true,
  logger: (message: string) => {
    // フォーム関連APIの場合は詳細ログを出力
    if (message.includes('/forms/company') || message.includes('forms/detect')) {
      console.group('🔍 Forms API Detailed Log')
      console.log(message)
      console.groupEnd()
    } else {
      console.log(message)
    }
  }
})

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
    
    // axios-loggerでリクエストをログ出力
    return AxiosLogger.requestLogger(config, {
      prefixText: config.url?.includes('/forms/') ? '[FORMS-API-REQUEST]' : '[API-REQUEST]',
      dateFormat: 'yyyy-mm-dd HH:MM:ss',
      status: true,
      headers: true,
      params: true,
      data: true,
      logger: (message: string) => {
        if (config.url?.includes('/forms/company')) {
          console.group('📤 /forms/company Request Details')
          console.log(message)
          console.log('🔗 Company ID:', config.url.match(/\/forms\/company\/(\d+)/)?.[1])
          console.log('⏰ Timestamp:', new Date().toISOString())
          console.groupEnd()
        } else if (config.url?.includes('/forms/')) {
          console.group('📤 Forms API Request')
          console.log(message)
          console.groupEnd()
        } else {
          console.log(message)
        }
      }
    })
  },
  (error) => {
    // エラーログも出力
    return AxiosLogger.errorLogger(error, {
      prefixText: '[API-REQUEST-ERROR]',
      logger: (message: string) => {
        console.group('❌ API Request Error')
        console.error(message)
        console.groupEnd()
      }
    })
  }
)

// レスポンスインターセプター - エラーハンドリングとsnake_case→camelCase変換
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // レスポンスデータをcamelCaseに変換
    response.data = convertKeysToCamelCase(response.data)
    
    // axios-loggerでレスポンスをログ出力
    return AxiosLogger.responseLogger(response, {
      prefixText: response.config.url?.includes('/forms/') ? '[FORMS-API-RESPONSE]' : '[API-RESPONSE]',
      dateFormat: 'yyyy-mm-dd HH:MM:ss',
      status: true,
      statusText: true,
      headers: true,
      data: true,
      logger: (message: string) => {
        if (response.config.url?.includes('/forms/company')) {
          console.group('📥 /forms/company Response Details')
          console.log(message)
          console.log('📊 Response Data Length:', Array.isArray(response.data) ? response.data.length : 'Not an array')
          console.log('⏱️ Response Time:', response.headers?.['x-response-time'] || 'N/A')
          console.log('💾 Cache Status:', response.headers?.['x-cache'] || 'N/A')
          console.log('⏰ Timestamp:', new Date().toISOString())
          if (Array.isArray(response.data) && response.data.length > 0) {
            console.log('🔍 First Form Preview:', response.data[0])
          }
          console.groupEnd()
        } else if (response.config.url?.includes('/forms/detect')) {
          console.group('📥 Forms Detection Response')
          console.log(message)
          console.log('🎯 Detection Status:', response.data?.status)
          console.log('🆔 Task ID:', response.data?.taskId)
          console.log('🏢 Company ID:', response.data?.companyId)
          console.groupEnd()
        } else if (response.config.url?.includes('/forms/')) {
          console.group('📥 Forms API Response')
          console.log(message)
          console.groupEnd()
        } else {
          console.log(message)
        }
      }
    })
  },
  (error: AxiosError<ApiError>) => {
    // axios-loggerでエラーをログ出力
    const loggedError = AxiosLogger.errorLogger(error, {
      prefixText: '[API-RESPONSE-ERROR]',
      logger: (message: string) => {
        if (error.config?.url?.includes('/forms/company')) {
          console.group('💥 /forms/company Error Details')
          console.error(message)
          console.log('🔗 Failed URL:', error.config?.url)
          console.log('📊 Status Code:', error.response?.status)
          console.log('📝 Error Detail:', error.response?.data?.detail)
          console.log('⏰ Timestamp:', new Date().toISOString())
          console.groupEnd()
        } else if (error.config?.url?.includes('/forms/')) {
          console.group('💥 Forms API Error')
          console.error(message)
          console.groupEnd()
        } else {
          console.group('💥 API Error')
          console.error(message)
          console.groupEnd()
        }
      }
    })
    
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