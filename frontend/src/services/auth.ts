import { api } from './api'
import { User } from '../types/models'

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  tokenType: string
}

export interface RegisterRequest {
  email: string
  username: string
  password: string
  isActive?: boolean
  isSuperuser?: boolean
}

/**
 * 認証関連のAPIサービス
 */
export const authService = {
  /**
   * ユーザーログイン
   * @param credentials ログイン情報（ユーザー名・パスワード）
   * @returns アクセストークン情報
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    // FastAPIのOAuth2PasswordRequestFormに対応するため、FormDataで送信
    const formData = new FormData()
    formData.append('username', credentials.username)
    formData.append('password', credentials.password)

    const response = await api.post<LoginResponse>('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    // トークンをローカルストレージに保存
    if (response.accessToken) {
      localStorage.setItem('access_token', response.accessToken)
    }

    return response
  },

  /**
   * ユーザー新規登録
   * @param userData 登録情報
   * @returns 作成されたユーザー情報
   */
  async register(userData: RegisterRequest): Promise<User> {
    const response = await api.post<User>('/auth/register', userData)
    return response
  },

  /**
   * ログアウト
   * ローカルストレージからトークンとユーザー情報を削除
   */
  logout(): void {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    // ログインページにリダイレクト
    window.location.href = '/login'
  },

  /**
   * 現在のユーザー情報を取得
   * @returns 現在のユーザー情報
   */
  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/auth/me')
    
    // ローカルストレージにユーザー情報を保存
    localStorage.setItem('user', JSON.stringify(response))
    
    return response
  },

  /**
   * ログイン状態をチェック
   * @returns ログイン済みかどうか
   */
  isAuthenticated(): boolean {
    const token = localStorage.getItem('access_token')
    return !!token
  },

  /**
   * 保存されたユーザー情報を取得
   * @returns ローカルストレージに保存されたユーザー情報
   */
  getStoredUser(): User | null {
    const userStr = localStorage.getItem('user')
    if (!userStr) return null
    
    try {
      const userData = JSON.parse(userStr)
      // Date文字列をDateオブジェクトに変換
      if (userData.createdAt) userData.createdAt = new Date(userData.createdAt)
      if (userData.updatedAt) userData.updatedAt = new Date(userData.updatedAt)
      return userData
    } catch {
      // 無効なJSONの場合は削除
      localStorage.removeItem('user')
      return null
    }
  },

  /**
   * アクセストークンを取得
   * @returns 保存されたアクセストークン
   */
  getAccessToken(): string | null {
    return localStorage.getItem('access_token')
  },

  /**
   * トークンの有効性を検証
   * @returns トークンが有効かどうか
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.getCurrentUser()
      return true
    } catch {
      // トークンが無効な場合は削除
      this.logout()
      return false
    }
  }
}

export default authService