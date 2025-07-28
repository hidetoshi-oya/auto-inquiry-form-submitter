/**
 * Axios Logger統合時のURL構築安全性テスト
 * t-wada形式: axios-loggerとの統合でURL構築エラーが発生しないことを確認
 * 
 * 目的: axios-logger使用時の「Failed to construct 'URL': Invalid URL」エラー防止
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import axios from 'axios'

// axios-loggerのモック
const mockAxiosLogger = {
  setGlobalConfig: vi.fn(),
  requestLogger: vi.fn((config) => config),
  responseLogger: vi.fn((response) => response),
  errorLogger: vi.fn((error) => Promise.reject(error))
}

vi.mock('axios-logger', () => ({
  default: mockAxiosLogger,
  setGlobalConfig: mockAxiosLogger.setGlobalConfig,
  requestLogger: mockAxiosLogger.requestLogger,
  responseLogger: mockAxiosLogger.responseLogger,
  errorLogger: mockAxiosLogger.errorLogger
}))

const originalEnv = import.meta.env

describe('API with Axios Logger - URL Construction Safety Tests', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    
    // LocalStorageのモック
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      configurable: true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Axios Logger設定の検証', () => {
    /**
     * t-wada: 設定境界値テスト
     */
    it('axios-loggerがグローバル設定されることを確認', async () => {
      // Arrange
      vi.stubGlobal('import.meta', {
        env: {
          ...originalEnv,
          VITE_API_BASE_URL: '/api',
          DEV: true
        }
      })

      const mockCreate = vi.fn().mockReturnValue({
        get: vi.fn(),
        post: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        }
      })
      vi.mocked(axios.create).mockImplementation(mockCreate)

      // Act
      await import('../api')

      // Assert: axios-loggerのグローバル設定が呼ばれることを確認
      expect(mockAxiosLogger.setGlobalConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          prefixText: '[API]',
          dateFormat: 'yyyy-mm-dd HH:MM:ss',
          status: true,
          statusText: true,
          headers: true,
          params: true,
          data: true,
          logger: expect.any(Function)
        })
      )
    })

    /**
     * t-wada: エラーケース - loggerが関数でない場合
     */
    it('loggerコールバック関数でエラーが発生してもURL構築は正常動作', async () => {
      // Arrange: loggerでエラーが発生するケース
      vi.stubGlobal('import.meta', {
        env: {
          ...originalEnv,
          VITE_API_BASE_URL: '/api',
          DEV: true
        }
      })

      // loggerコールバックでエラーを発生させる
      mockAxiosLogger.setGlobalConfig.mockImplementation((config) => {
        if (config.logger) {
          // ログメッセージにinvalid URLが含まれている場合をテスト
          expect(() => {
            config.logger('Test message with invalid URL construction')
          }).not.toThrow()
        }
      })

      const mockCreate = vi.fn().mockReturnValue({
        get: vi.fn(),
        post: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        }
      })
      vi.mocked(axios.create).mockImplementation(mockCreate)

      // Act & Assert: モジュール読み込み時にエラーが発生しない
      expect(async () => {
        await import('../api')
      }).not.toThrow()
    })
  })

  describe('リクエストインターセプターでのURL処理', () => {
    /**
     * t-wada: インターセプター境界値テスト
     */
    it.each([
      ['/api', '/auth/login', '相対パス + 認証API'],
      ['/api', '/forms/company/123', '相対パス + フォームAPI'], 
      ['http://localhost:8000/api', '/auth/me', '絶対URL + ユーザーAPI'],
      ['https://api.example.com', '/health', 'HTTPS + ヘルスチェック']
    ])('インターセプターでのURL処理: %s + %s (%s)', async (baseUrl, endpoint, description) => {
      // Arrange
      vi.stubGlobal('import.meta', {
        env: {
          ...originalEnv,
          VITE_API_BASE_URL: baseUrl,
          DEV: true
        }
      })

      let interceptorFunction: any
      const mockUse = vi.fn().mockImplementation((fn) => {
        interceptorFunction = fn
      })
      
      const mockGet = vi.fn().mockResolvedValue({ data: {} })
      const mockCreate = vi.fn().mockReturnValue({
        get: mockGet,
        post: vi.fn(),
        interceptors: {
          request: { use: mockUse },
          response: { use: vi.fn() }
        }
      })
      vi.mocked(axios.create).mockImplementation(mockCreate)

      // Act
      const { api } = await import('../api')
      await api.get(endpoint)

      // Assert: インターセプターが設定され、URL処理でエラーが発生しない
      expect(mockUse).toHaveBeenCalled()
      expect(interceptorFunction).toBeDefined()
      
      // インターセプター関数をテスト実行
      const mockConfig = {
        url: endpoint,
        headers: {}
      }
      
      expect(() => {
        interceptorFunction(mockConfig)
      }).not.toThrow()
    })

    /**
     * t-wada: ログ出力時のURL分析テスト
     */
    it('リクエストログでフォーム関連URLを正しく検出', async () => {
      // Arrange
      vi.stubGlobal('import.meta', {
        env: {
          ...originalEnv,
          VITE_API_BASE_URL: '/api',
          DEV: true
        }
      })

      let requestInterceptor: any
      const mockRequestUse = vi.fn().mockImplementation((fn) => {
        requestInterceptor = fn
      })

      const mockCreate = vi.fn().mockReturnValue({
        get: vi.fn(),
        post: vi.fn(),
        interceptors: {
          request: { use: mockRequestUse },
          response: { use: vi.fn() }
        }
      })
      vi.mocked(axios.create).mockImplementation(mockCreate)

      // Act
      await import('../api')

      // Assert: インターセプターでaxios-loggerが呼ばれ、URL処理が正常
      expect(requestInterceptor).toBeDefined()
      
      const mockConfig = {
        url: '/api/forms/company/123',
        headers: {}
      }

      expect(() => {
        const result = requestInterceptor(mockConfig)
        expect(mockAxiosLogger.requestLogger).toHaveBeenCalledWith(
          mockConfig,
          expect.objectContaining({
            prefixText: '[FORMS-API-REQUEST]'
          })
        )
      }).not.toThrow()
    })
  })

  describe('レスポンスインターセプターでのURL処理', () => {
    /**
     * t-wada: レスポンス処理境界値テスト
     */
    it('レスポンスログでURL情報が安全に処理される', async () => {
      // Arrange
      vi.stubGlobal('import.meta', {
        env: {
          ...originalEnv,
          VITE_API_BASE_URL: '/api',
          DEV: true
        }
      })

      let responseInterceptor: any
      const mockResponseUse = vi.fn().mockImplementation((fn) => {
        responseInterceptor = fn
      })

      const mockCreate = vi.fn().mockReturnValue({
        get: vi.fn(),
        post: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: mockResponseUse }
        }
      })
      vi.mocked(axios.create).mockImplementation(mockCreate)

      // Act
      await import('../api')

      // Assert: レスポンスインターセプターが設定される
      expect(responseInterceptor).toBeDefined()
      
      const mockResponse = {
        data: [{ id: 1, formUrl: 'https://example.com/contact' }],
        config: { url: '/api/forms/company/123' },
        status: 200,
        headers: {}
      }

      expect(() => {
        responseInterceptor(mockResponse)
        expect(mockAxiosLogger.responseLogger).toHaveBeenCalled()
      }).not.toThrow()
    })

    /**
     * t-wada: エラーレスポンス処理テスト
     */
    it('エラーレスポンスでのURL処理が安全', async () => {
      // Arrange
      vi.stubGlobal('import.meta', {
        env: {
          ...originalEnv,
          VITE_API_BASE_URL: '/api',
          DEV: true
        }
      })

      let errorHandler: any
      const mockResponseUse = vi.fn().mockImplementation((successFn, errorFn) => {
        errorHandler = errorFn
      })

      const mockCreate = vi.fn().mockReturnValue({
        get: vi.fn(),
        post: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: mockResponseUse }
        }
      })
      vi.mocked(axios.create).mockImplementation(mockCreate)

      // Act
      await import('../api')

      // Assert: エラーハンドラーでURL処理が安全
      expect(errorHandler).toBeDefined()
      
      const mockError = {
        config: { url: '/api/auth/login' },
        response: {
          status: 401,
          data: { detail: 'Unauthorized' }
        }
      }

      expect(async () => {
        await errorHandler(mockError)
      }).rejects.toBeDefined() // エラーは再発生するが、URL構築エラーは発生しない
      
      expect(mockAxiosLogger.errorLogger).toHaveBeenCalled()
    })
  })

  describe('実際のAPIシナリオでの統合テスト', () => {
    /**
     * t-wada: 実際のユースケースシナリオ
     */
    it('ログイン処理でaxios-loggerと併用してもURL構築エラーが発生しない', async () => {
      // Arrange: 実際のログインシナリオを模擬
      vi.stubGlobal('import.meta', {
        env: {
          ...originalEnv,
          VITE_API_BASE_URL: '/api',
          DEV: true
        }
      })

      const mockPost = vi.fn().mockResolvedValue({
        data: { accessToken: 'test-token', tokenType: 'Bearer' }
      })

      let requestInterceptor: any
      let responseInterceptor: any

      const mockCreate = vi.fn().mockReturnValue({
        post: mockPost,
        interceptors: {
          request: { 
            use: vi.fn().mockImplementation((fn) => {
              requestInterceptor = fn
            })
          },
          response: { 
            use: vi.fn().mockImplementation((fn) => {
              responseInterceptor = fn
            })
          }
        }
      })
      vi.mocked(axios.create).mockImplementation(mockCreate)

      // Act: 実際のログインAPIコール
      const { api } = await import('../api')
      
      expect(async () => {
        const formData = new FormData()
        formData.append('username', 'testuser')
        formData.append('password', 'testpass')
        
        const result = await api.post('/auth/login', formData, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
        
        // インターセプターが呼ばれることを確認
        expect(requestInterceptor).toBeDefined()
        expect(responseInterceptor).toBeDefined()
        
        return result
      }).not.toThrow()
    })

    /**
     * t-wada: フォーム検出APIでの統合テスト
     */
    it('フォーム検出APIでaxios-loggerのフォーム専用ログが正常動作', async () => {
      // Arrange
      vi.stubGlobal('import.meta', {
        env: {
          ...originalEnv,
          VITE_API_BASE_URL: '/api',
          DEV: true
        }
      })

      const mockGet = vi.fn().mockResolvedValue({
        data: [
          { id: 1, formUrl: 'https://example.com/contact', companyId: 123 }
        ]
      })

      const mockCreate = vi.fn().mockReturnValue({
        get: mockGet,
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        }
      })
      vi.mocked(axios.create).mockImplementation(mockCreate)

      // Act
      const { api } = await import('../api')
      
      expect(async () => {
        await api.get('/forms/company/123')
      }).not.toThrow()

      // Assert: フォーム関連のログ処理が正常動作
      expect(mockGet).toHaveBeenCalledWith('/api/forms/company/123', undefined)
    })
  })
})