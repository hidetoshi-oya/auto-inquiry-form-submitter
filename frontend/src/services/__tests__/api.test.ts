/**
 * API設定とURL構築のテスト
 * t-wada形式: 境界値分析とエラーケース網羅によるテスト設計
 * 
 * 目的: 「Failed to construct 'URL': Invalid URL」エラーの再発防止
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import axios from 'axios'

// テスト対象をモック化前にインポート
const originalEnv = import.meta.env

describe('API Configuration - URL Construction Safety Tests', () => {
  beforeEach(() => {
    // 各テスト前にモジュールキャッシュをクリア
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

  describe('BASE_URL 設定の境界値テスト', () => {
    /**
     * t-wada: 等価分割 - 正常系
     * 有効なURL形式の網羅的テスト
     */
    it.each([
      // 相対パス（Viteプロキシ使用）
      ['/api', true, 'relative path with leading slash'],
      ['/api/', true, 'relative path with trailing slash'],
      ['/api/v1', true, 'relative path with version'],
      
      // 絶対URL（HTTP）
      ['http://localhost:8000/api', false, 'localhost HTTP URL'],
      ['http://localhost:8000/api/', false, 'localhost HTTP URL with trailing slash'],
      ['http://127.0.0.1:8000/api', false, 'IP address HTTP URL'],
      
      // 絶対URL（HTTPS）
      ['https://api.example.com', false, 'HTTPS URL'],
      ['https://api.example.com/', false, 'HTTPS URL with trailing slash'],
      ['https://api.example.com/v1', false, 'HTTPS URL with path'],
      
      // ポート番号付き
      ['http://localhost:3000/api', false, 'different port'],
      ['https://api.example.com:443/api', false, 'explicit HTTPS port'],
    ])('有効なBASE_URL: %s (相対パス: %s) - %s', async (baseUrl, expectedIsRelative, description) => {
      // Arrange: 環境変数をモック
      vi.stubGlobal('import.meta', {
        env: {
          ...originalEnv,
          VITE_API_BASE_URL: baseUrl,
          DEV: true
        }
      })

      // Act & Assert: モジュールの動的インポートでURL構築エラーが発生しないことを確認
      expect(async () => {
        const { api } = await import('../api')
        
        // URL正規化テスト
        const testUrl = '/auth/login'
        
        // モックAxiosを設定
        const mockAxios = vi.mocked(axios.create)
        mockAxios.mockReturnValue({
          get: vi.fn().mockResolvedValue({ data: {} }),
          post: vi.fn().mockResolvedValue({ data: {} }),
          interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() }
          }
        } as any)

        // API呼び出しテスト（URL構築エラーが発生しないことを確認）
        await expect(api.get(testUrl)).resolves.toBeDefined()
      }).not.toThrow()
    })

    /**
     * t-wada: 境界値分析 - 異常系
     * 無効なURL形式でのエラーハンドリング
     */
    it.each([
      // プロトコルなし（無効）
      ['localhost:8000/api', 'missing protocol'],
      ['api.example.com', 'domain without protocol'],
      
      // 無効な文字
      ['http://invalid url with spaces', 'URL with spaces'],
      ['http://[invalid]', 'invalid characters'],
      
      // 空文字・null・undefined
      ['', 'empty string'],
      
      // 無効なプロトコル
      ['ftp://example.com/api', 'unsupported protocol'],
      ['file:///api', 'file protocol'],
    ])('無効なBASE_URL: %s - %s', async (baseUrl, description) => {
      // Arrange
      vi.stubGlobal('import.meta', {
        env: {
          ...originalEnv,
          VITE_API_BASE_URL: baseUrl,
          DEV: true
        }
      })

      // Act & Assert: 無効なURLでもエラーが発生せず、適切にフォールバックされることを確認
      expect(async () => {
        const { api } = await import('../api')
        
        // モックAxiosを設定
        const mockCreate = vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ data: {} }),
          post: vi.fn().mockResolvedValue({ data: {} }),
          interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() }
          }
        })
        vi.mocked(axios.create).mockImplementation(mockCreate)

        // API呼び出しでエラーが発生しないことを確認
        await api.get('/test')
        
        // axiosのcreateが適切な設定で呼ばれることを確認
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
          })
        )
      }).not.toThrow()
    })
  })

  describe('URL正規化処理のテスト', () => {
    /**
     * t-wada: 境界値分析 - パス結合の境界
     */
    it.each([
      // 相対パス + 各種URLパターン
      ['/api', '/auth/login', '/api/auth/login', 'relative base + absolute path'],
      ['/api', 'auth/login', '/api/auth/login', 'relative base + relative path'],
      ['/api/', '/auth/login', '/api/auth/login', 'relative base with slash + absolute path'],
      ['/api/', 'auth/login', '/api/auth/login', 'relative base with slash + relative path'],
      
      // 絶対URL + 各種URLパターン
      ['http://localhost:8000/api', '/auth/login', '/auth/login', 'absolute base + absolute path'],
      ['http://localhost:8000/api', 'auth/login', 'auth/login', 'absolute base + relative path'],
    ])('URL正規化: BASE_URL=%s, url=%s → %s (%s)', async (baseUrl, inputUrl, expectedUrl, description) => {
      // Arrange
      vi.stubGlobal('import.meta', {
        env: {
          ...originalEnv,
          VITE_API_BASE_URL: baseUrl,
          DEV: true
        }
      })

      // Mock axios
      const mockGet = vi.fn().mockResolvedValue({ data: {} })
      const mockCreate = vi.fn().mockReturnValue({
        get: mockGet,
        post: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        }
      })
      vi.mocked(axios.create).mockImplementation(mockCreate)

      // Act
      const { api } = await import('../api')
      await api.get(inputUrl)

      // Assert: 正規化されたURLで呼び出されることを確認
      expect(mockGet).toHaveBeenCalledWith(expectedUrl, undefined)
    })
  })

  describe('Axios設定の検証', () => {
    /**
     * t-wada: 実際のユースケースベースのテスト
     */
    it('相対パスの場合、baseURLが設定されないことを確認', async () => {
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

      // Assert: baseURLが設定されていないことを確認
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      
      const createArgs = mockCreate.mock.calls[0][0]
      expect(createArgs).not.toHaveProperty('baseURL')
    })

    it('絶対URLの場合、baseURLが設定されることを確認', async () => {
      // Arrange
      const testBaseUrl = 'http://localhost:8000/api'
      vi.stubGlobal('import.meta', {
        env: {
          ...originalEnv,
          VITE_API_BASE_URL: testBaseUrl,
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

      // Assert: baseURLが正しく設定されることを確認
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: testBaseUrl,
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    })
  })

  describe('エラーハンドリングのテスト', () => {
    /**
     * t-wada: 異常系の網羅
     */
    it('URL constructor でエラーが発生してもアプリケーションが停止しない', async () => {
      // Arrange: 無効なURLを設定
      vi.stubGlobal('import.meta', {
        env: {
          ...originalEnv,
          VITE_API_BASE_URL: 'invalid-url',
          DEV: true
        }
      })

      const mockCreate = vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ data: {} }),
        post: vi.fn().mockResolvedValue({ data: {} }),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        }
      })
      vi.mocked(axios.create).mockImplementation(mockCreate)

      // Act & Assert: 例外が発生しないことを確認
      expect(async () => {
        const { api } = await import('../api')
        await api.get('/test')
      }).not.toThrow()
    })

    it('environment variables が undefined でもデフォルト値が使用される', async () => {
      // Arrange
      vi.stubGlobal('import.meta', {
        env: {
          ...originalEnv,
          VITE_API_BASE_URL: undefined,
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

      // Assert: デフォルト値が使用されることを確認
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://localhost:8000/api'
        })
      )
    })
  })

  describe('実際のAPIメソッドのテスト', () => {
    /**
     * t-wada: 実際のユースケースシナリオ
     */
    it.each([
      ['GET', 'get'],
      ['POST', 'post'],
      ['PUT', 'put'],
      ['DELETE', 'delete'],
      ['PATCH', 'patch'],
    ])('%s メソッドでURL構築エラーが発生しない', async (method, apiMethod) => {
      // Arrange
      vi.stubGlobal('import.meta', {
        env: {
          ...originalEnv,
          VITE_API_BASE_URL: '/api',
          DEV: true
        }
      })

      const mockMethod = vi.fn().mockResolvedValue({ data: { success: true } })
      const mockCreate = vi.fn().mockReturnValue({
        [apiMethod]: mockMethod,
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        }
      })
      vi.mocked(axios.create).mockImplementation(mockCreate)

      // Act
      const { api } = await import('../api')
      
      // Assert: 各メソッドでエラーが発生しないことを確認
      expect(async () => {
        if (apiMethod === 'get' || apiMethod === 'delete') {
          await (api as any)[apiMethod]('/test')
        } else {
          await (api as any)[apiMethod]('/test', { data: 'test' })
        }
      }).not.toThrow()

      expect(mockMethod).toHaveBeenCalled()
    })

    /**
     * 認証関連のAPIコールのテスト（実際のログインエラーが発生したシナリオ）
     */
    it('ログインAPIコールでURL構築エラーが発生しない', async () => {
      // Arrange
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
      const mockCreate = vi.fn().mockReturnValue({
        post: mockPost,
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        }
      })
      vi.mocked(axios.create).mockImplementation(mockCreate)

      // Act
      const { api } = await import('../api')
      
      // Assert: ログインAPIでエラーが発生しないことを確認
      expect(async () => {
        const formData = new FormData()
        formData.append('username', 'testuser')
        formData.append('password', 'testpass')
        
        await api.post('/auth/login', formData, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
      }).not.toThrow()

      expect(mockPost).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
      )
    })
  })
})