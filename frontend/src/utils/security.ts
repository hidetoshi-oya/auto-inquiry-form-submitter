/**
 * フロントエンドセキュリティユーティリティ
 * OWASP ベストプラクティスに基づく実装
 */

// XSS攻撃対策
export class XSSProtection {
  /**
   * HTMLエスケープ
   */
  static escapeHtml(unsafe: string): string {
    if (!unsafe) return ''
    
    const escapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    }
    
    return unsafe.replace(/[&<>"'`=\/]/g, (match) => escapeMap[match])
  }

  /**
   * URLエスケープ
   */
  static escapeUrl(url: string): string {
    if (!url) return ''
    
    try {
      return encodeURIComponent(url)
    } catch {
      return ''
    }
  }

  /**
   * 危険なHTMLタグの除去
   */
  static sanitizeHtml(html: string): string {
    if (!html) return ''
    
    // 危険なタグと属性を除去
    const dangerousTags = /<(script|object|embed|form|iframe|meta|link)[^>]*>.*?<\/\1>/gi
    const dangerousAttributes = /(on\w+|javascript:|vbscript:|data:)/gi
    
    return html
      .replace(dangerousTags, '')
      .replace(dangerousAttributes, '')
  }

  /**
   * CSP違反の報告
   */
  static setupCSPReporting(): void {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.warn('CSP Violation:', {
        blockedURI: event.blockedURI,
        violatedDirective: event.violatedDirective,
        originalPolicy: event.originalPolicy
      })
      
      // 本番環境では監視サービスに送信
      if (import.meta.env.PROD) {
        // fetch('/api/security/csp-violation', { ... })
      }
    })
  }
}

// URL検証
export class URLValidator {
  private static readonly ALLOWED_PROTOCOLS = ['http:', 'https:']
  private static readonly FORBIDDEN_DOMAINS = [
    'localhost',
    '127.0.0.1',
    '::1',
    '0.0.0.0'
  ]

  /**
   * URL の妥当性を検証
   */
  static validate(url: string): boolean {
    if (!url) return false

    try {
      const parsed = new URL(url)
      
      // プロトコルチェック
      if (!this.ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        return false
      }

      // 禁止ドメインチェック
      if (this.FORBIDDEN_DOMAINS.includes(parsed.hostname)) {
        return false
      }

      // プライベートIP範囲チェック
      if (this.isPrivateIP(parsed.hostname)) {
        return false
      }

      return true
    } catch {
      return false
    }
  }

  private static isPrivateIP(hostname: string): boolean {
    // IPv4 プライベート範囲
    const privateIPv4Ranges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^169\.254\./ // Link-local
    ]

    return privateIPv4Ranges.some(range => range.test(hostname))
  }
}

// 入力検証
export class InputValidator {
  /**
   * メールアドレス検証
   */
  static validateEmail(email: string): boolean {
    if (!email) return false
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return emailRegex.test(email) && email.length <= 254
  }

  /**
   * 文字列長制限チェック
   */
  static validateLength(text: string, maxLength: number): boolean {
    return Boolean(text) && text.length <= maxLength
  }

  /**
   * 危険な文字列パターンチェック
   */
  static containsMaliciousPattern(text: string): boolean {
    if (!text) return false

    const maliciousPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,
      /<iframe[\s\S]*?>/gi,
      /<object[\s\S]*?>/gi,
      /<embed[\s\S]*?>/gi
    ]

    return maliciousPatterns.some(pattern => pattern.test(text))
  }

  /**
   * SQL インジェクション パターンチェック
   */
  static containsSQLInjection(text: string): boolean {
    if (!text) return false

    const sqlPatterns = [
      /(\bunion\b|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b)/gi,
      /(\bor\b|\band\b)\s+\w+\s*=\s*\w+/gi,
      /['"];?\s*(--|\#|\/*)/gi
    ]

    return sqlPatterns.some(pattern => pattern.test(text))
  }
}

// セキュアなストレージ
export class SecureStorage {
  /**
   * セキュアにデータを保存
   */
  static setItem(key: string, value: any): void {
    try {
      const sanitizedKey = XSSProtection.escapeHtml(key)
      const jsonValue = JSON.stringify(value)
      
      // 機密データかチェック
      if (this.isSensitiveData(key)) {
        // sessionStorage使用（タブ閉じで削除）
        sessionStorage.setItem(sanitizedKey, jsonValue)
      } else {
        localStorage.setItem(sanitizedKey, jsonValue)
      }
    } catch (error) {
      console.error('Storage error:', error)
    }
  }

  /**
   * セキュアにデータを取得
   */
  static getItem(key: string): any {
    try {
      const sanitizedKey = XSSProtection.escapeHtml(key)
      
      let value = sessionStorage.getItem(sanitizedKey)
      if (!value) {
        value = localStorage.getItem(sanitizedKey)
      }
      
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.error('Storage retrieval error:', error)
      return null
    }
  }

  /**
   * データを削除
   */
  static removeItem(key: string): void {
    const sanitizedKey = XSSProtection.escapeHtml(key)
    sessionStorage.removeItem(sanitizedKey)
    localStorage.removeItem(sanitizedKey)
  }

  private static isSensitiveData(key: string): boolean {
    const sensitiveKeys = [
      'token',
      'auth',
      'session',
      'password',
      'secret',
      'csrf'
    ]
    
    return sensitiveKeys.some(sensitive => 
      key.toLowerCase().includes(sensitive)
    )
  }
}

// CSRF保護
export class CSRFProtection {
  private static token: string = ''

  /**
   * CSRFトークンを取得
   */
  static async getToken(): Promise<string> {
    if (this.token) {
      return this.token
    }

    try {
      const response = await fetch('/api/auth/csrf-token', {
        method: 'GET',
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.token && typeof data.token === 'string') {
          this.token = data.token
        } else {
          this.token = this.generateRandomToken()
        }
        return this.token
      }
    } catch (error) {
      console.error('CSRF token fetch error:', error)
    }

    // フォールバック：ランダムトークン生成
    this.token = this.generateRandomToken()
    return this.token
  }

  /**
   * リクエストヘッダーにCSRFトークンを追加
   */
  static async addToHeaders(headers: Record<string, string> = {}): Promise<Record<string, string>> {
    const token = await this.getToken()
    return {
      ...headers,
      'X-CSRF-Token': token
    }
  }

  private static generateRandomToken(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }
}

// セキュアなHTTPクライアント
export class SecureHttpClient {
  /**
   * セキュアなFetch実行
   */
  static async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    // URL検証
    if (!URLValidator.validate(url)) {
      throw new Error('Invalid URL')
    }

    // CSRFトークン追加
    const headers = await CSRFProtection.addToHeaders(
      options.headers as Record<string, string>
    )

    // セキュリティヘッダー追加
    const secureHeaders = {
      ...headers,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    }

    const secureOptions: RequestInit = {
      ...options,
      headers: secureHeaders,
      credentials: 'include', // CSRF保護のためCookieを含める
      cache: 'no-cache' // キャッシュ攻撃防止
    }

    try {
      const response = await fetch(url, secureOptions)
      
      // レート制限チェック
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        throw new Error(`Rate limited. Retry after ${retryAfter} seconds`)
      }

      return response
    } catch (error) {
      console.error('Secure fetch error:', error)
      throw error
    }
  }
}

// セキュリティイベントリスナー
export class SecurityEventHandler {
  /**
   * セキュリティイベントの初期化
   */
  static initialize(): void {
    // CSP違反の監視
    XSSProtection.setupCSPReporting()

    // コンソール改ざん検知（開発者ツール検知）
    this.setupConsoleProtection()

    // 右クリック無効化（オプション）
    // this.disableRightClick()

    // ページ離脱時の警告（機密画面用）
    this.setupPageLeaveWarning()
  }

  private static setupConsoleProtection(): void {
    if (import.meta.env.PROD) {
      const originalLog = console.log
      console.log = function(...args) {
        if (args[0]?.includes?.('developer')) {
          console.warn('Unauthorized console access detected')
        }
        originalLog.apply(console, args)
      }
    }
  }

  private static setupPageLeaveWarning(): void {
    window.addEventListener('beforeunload', (event) => {
      // フォームに未保存データがある場合のみ警告
      const hasUnsavedData = document.querySelector('[data-unsaved]')
      if (hasUnsavedData) {
        event.preventDefault()
        event.returnValue = ''
      }
    })
  }
}

// セキュリティユーティリティのエクスポート
export const Security = {
  XSSProtection,
  URLValidator,
  InputValidator,
  SecureStorage,
  CSRFProtection,
  SecureHttpClient,
  SecurityEventHandler
} as const 