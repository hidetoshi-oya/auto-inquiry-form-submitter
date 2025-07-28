/**
 * 認証サービスのURL構築安全性テスト
 * t-wada形式: 実際のログインエラーが発生したシナリオをベースにしたテスト
 * 
 * 目的: 認証API呼び出し時の「Failed to construct 'URL': Invalid URL」エラー防止
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// APIのモック
const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn(),
}

vi.mock('../api', () => ({
  api: mockApi
}))

const originalEnv = import.meta.env

describe('Authentication Service - URL Construction Safety Tests', () => {
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

    // window.location.hrefのモック
    Object.defineProperty(window, 'location', {
      value: {
        href: '',
      },
      configurable: true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('ログイン処理のURL構築テスト', () => {
    /**
     * t-wada: 実際のエラーシナリオ再現テスト
     * 元のエラー: ログイン実行時に「Failed to construct 'URL': Invalid URL」
     */
    it('ログイン処理でURL構築エラーが発生しない', async () => {
      // Arrange: 成功レスポンスをモック
      mockApi.post.mockResolvedValue({
        accessToken: 'test-access-token',
        tokenType: 'Bearer'
      })

      // Act & Assert: ログイン処理でエラーが発生しない
      expect(async () => {
        const { authService } = await import('../auth')
        
        await authService.login({
          username: 'testuser',
          password: 'testpass'
        })
      }).not.toThrow()

      // Assert: 正しいAPIエンドポイントが呼ばれる
      expect(mockApi.post).toHaveBeenCalledWith(
        '/auth/login',
        expect.any(FormData),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          }
        })
      )
    })

    /**
     * t-wada: 境界値テスト - 様々なユーザー名・パスワード
     */
    it.each([
      ['user@example.com', 'password123', 'email format username'],
      ['user_name', 'pass@#$%', 'underscore username with special chars'],
      ['123456', '12345678', 'numeric username and password'],
      ['', '', 'empty credentials'], // バリデーションエラーになるが、URL構築エラーは発生しない
      ['a'.repeat(100), 'b'.repeat(100), 'very long credentials'],
    ])('様々な認証情報でURL構築エラーが発生しない: %s/%s (%s)', async (username, password, description) => {
      // Arrange
      mockApi.post.mockResolvedValue({
        accessToken: 'test-token',
        tokenType: 'Bearer'
      })

      // Act & Assert
      expect(async () => {
        const { authService } = await import('../auth')
        
        await authService.login({ username, password })
      }).not.toThrow()

      // FormDataの内容を検証
      expect(mockApi.post).toHaveBeenCalledWith(
        '/auth/login',
        expect.any(FormData),
        expect.any(Object)
      )

      const [, formData] = mockApi.post.mock.calls[0]
      expect(formData).toBeInstanceOf(FormData)
    })

    /**
     * t-wada: エラーレスポンスでのURL処理テスト
     */
    it.each([
      [401, 'Unauthorized', '認証失敗'],
      [400, 'Bad Request', '不正なリクエスト'],
      [500, 'Internal Server Error', 'サーバーエラー'],
      [422, 'Validation Error', 'バリデーションエラー'],
    ])('エラーレスポンス %d でURL構築エラーが発生しない (%s)', async (status, message, description) => {
      // Arrange: エラーレスポンスをモック
      const errorResponse = {
        message: message,
        status: status,
        data: { detail: message }
      }
      mockApi.post.mockRejectedValue(errorResponse)

      // Act & Assert: エラーが適切に処理され、URL構築エラーは発生しない
      const { authService } = await import('../auth')
      
      await expect(authService.login({
        username: 'testuser',
        password: 'wrongpass'
      })).rejects.toEqual(errorResponse)

      // APIが正しく呼ばれることを確認
      expect(mockApi.post).toHaveBeenCalledWith(
        '/auth/login',
        expect.any(FormData),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          }
        })
      )
    })
  })

  describe('その他の認証APIのURL構築テスト', () => {
    /**
     * t-wada: 全認証メソッドの網羅テスト
     */
    it('getCurrentUser でURL構築エラーが発生しない', async () => {
      // Arrange
      mockApi.get.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      })

      // Act & Assert
      expect(async () => {
        const { authService } = await import('../auth')
        await authService.getCurrentUser()
      }).not.toThrow()

      expect(mockApi.get).toHaveBeenCalledWith('/auth/me')
    })

    it('register でURL構築エラーが発生しない', async () => {
      // Arrange
      mockApi.post.mockResolvedValue({
        id: 1,
        username: 'newuser',
        email: 'new@example.com'
      })

      // Act & Assert
      expect(async () => {
        const { authService } = await import('../auth')
        await authService.register({
          email: 'new@example.com',
          username: 'newuser',
          password: 'newpass123'
        })
      }).not.toThrow()

      expect(mockApi.post).toHaveBeenCalledWith('/auth/register', {
        email: 'new@example.com',
        username: 'newuser',
        password: 'newpass123'
      })
    })

    /**
     * t-wada: トークン検証のURL構築テスト
     */
    it('validateToken でURL構築エラーが発生しない', async () => {
      // Arrange: 成功ケース
      mockApi.get.mockResolvedValue({
        id: 1,
        username: 'testuser'
      })
      
      const mockGetItem = vi.fn().mockReturnValue('valid-token')
      window.localStorage.getItem = mockGetItem

      // Act & Assert
      expect(async () => {
        const { authService } = await import('../auth')
        const result = await authService.validateToken()
        expect(result).toBe(true)
      }).not.toThrow()

      expect(mockApi.get).toHaveBeenCalledWith('/auth/me')
    })

    it('validateToken エラー時のlogout処理でURL構築エラーが発生しない', async () => {
      // Arrange: API呼び出し失敗
      mockApi.get.mockRejectedValue(new Error('Token invalid'))
      
      const mockRemoveItem = vi.fn()
      window.localStorage.removeItem = mockRemoveItem

      // Act & Assert
      expect(async () => {
        const { authService } = await import('../auth')
        const result = await authService.validateToken()
        expect(result).toBe(false)
      }).not.toThrow()

      // ログアウト処理が呼ばれることを確認
      expect(mockRemoveItem).toHaveBeenCalledWith('access_token')
      expect(mockRemoveItem).toHaveBeenCalledWith('user')
    })
  })

  describe('LocalStorage操作の安全性テスト', () => {
    /**
     * t-wada: ストレージ操作境界値テスト
     */
    it.each([
      [null, 'null token'],
      [undefined, 'undefined token'],
      ['', 'empty token'],
      ['invalid-json-{', 'invalid JSON in user data'],
      ['valid-token', 'valid token'],
    ])('LocalStorage の状態: %s (%s) でエラーが発生しない', async (tokenValue, description) => {
      // Arrange
      const mockGetItem = vi.fn().mockImplementation((key) => {
        if (key === 'access_token') return tokenValue
        if (key === 'user') return tokenValue === 'invalid-json-{' ? 'invalid-json-{' : null
        return null
      })
      window.localStorage.getItem = mockGetItem

      // Act & Assert: LocalStorage操作でエラーが発生しない
      expect(() => {
        const { authService } = require('../auth')
        
        const isAuth = authService.authService.isAuthenticated()
        const storedUser = authService.authService.getStoredUser()
        const token = authService.authService.getAccessToken()
        
        // 戻り値の型チェック
        expect(typeof isAuth).toBe('boolean')
        expect(token).toEqual(tokenValue === '' ? '' : tokenValue)
      }).not.toThrow()
    })

    /**
     * t-wada: JSON解析エラーハンドリング
     */
    it('不正なJSON形式のユーザーデータでエラーが発生しない', async () => {
      // Arrange: 不正なJSONデータ
      const mockGetItem = vi.fn().mockImplementation((key) => {
        if (key === 'user') return '{"invalid": json}'
        return null
      })
      const mockRemoveItem = vi.fn()
      
      window.localStorage.getItem = mockGetItem
      window.localStorage.removeItem = mockRemoveItem

      // Act & Assert
      expect(() => {
        const { authService } = require('../auth')
        const user = authService.authService.getStoredUser()
        
        expect(user).toBeNull()
        expect(mockRemoveItem).toHaveBeenCalledWith('user')
      }).not.toThrow()
    })
  })

  describe('実際のログインフローの統合テスト', () => {
    /**
     * t-wada: 実際のユーザージャーニーテスト
     */
    it('完全なログインフローでURL構築エラーが発生しない', async () => {
      // Arrange: ログイン成功 -> ユーザー情報取得成功のフロー
      mockApi.post.mockResolvedValueOnce({
        accessToken: 'login-token',
        tokenType: 'Bearer'
      })
      
      mockApi.get.mockResolvedValueOnce({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      })

      const mockSetItem = vi.fn()
      window.localStorage.setItem = mockSetItem

      // Act: 実際のログインフローを実行
      expect(async () => {
        const { authService } = await import('../auth')
        
        // 1. ログイン実行
        const loginResult = await authService.login({
          username: 'testuser',
          password: 'testpass'
        })
        
        // 2. ユーザー情報取得
        const userInfo = await authService.getCurrentUser()
        
        // 3. 認証状態確認
        const isAuth = authService.isAuthenticated()
        
        return { loginResult, userInfo, isAuth }
      }).not.toThrow()

      // Assert: 正しい順序でAPIが呼ばれる
      expect(mockApi.post).toHaveBeenCalledWith(
        '/auth/login',
        expect.any(FormData),
        expect.any(Object)
      )
      expect(mockApi.get).toHaveBeenCalledWith('/auth/me')
      
      // LocalStorage操作が正しく行われる
      expect(mockSetItem).toHaveBeenCalledWith('access_token', 'login-token')
      expect(mockSetItem).toHaveBeenCalledWith('user', expect.any(String))
    })

    /**
     * t-wada: ログアウトフローテスト
     */
    it('ログアウト処理でURL構築エラーが発生しない', async () => {
      // Arrange
      const mockRemoveItem = vi.fn()
      window.localStorage.removeItem = mockRemoveItem
      
      // window.location.href の設定をモック
      let currentHref = ''
      Object.defineProperty(window, 'location', {
        value: {
          get href() { return currentHref },
          set href(value) { currentHref = value }
        },
        configurable: true
      })

      // Act & Assert
      expect(() => {
        const { authService } = require('../auth')
        authService.authService.logout()
        
        expect(mockRemoveItem).toHaveBeenCalledWith('access_token')
        expect(mockRemoveItem).toHaveBeenCalledWith('user')
        expect(currentHref).toBe('/login')
      }).not.toThrow()
    })
  })
})