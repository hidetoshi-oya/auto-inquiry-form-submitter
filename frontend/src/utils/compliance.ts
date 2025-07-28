/**
 * フロントエンドコンプライアンス機能
 * バックエンドのコンプライアンスAPIとの連携
 */

import { SecureHttpClient } from './security'

export interface ComplianceCheck {
  url: string
  allowed: boolean
  warnings: string[]
  errors: string[]
  recommendations: string[]
  delay_seconds: number
  compliance_level: string
}

export interface SitePolicy {
  url: string
  robots_txt_url: string
  terms_of_service_url: string | null
  allows_crawling: boolean
  requires_delay: number
  detected_restrictions: string[]
}

export interface ComplianceStats {
  total_checks: number
  allowed_count: number
  blocked_count: number
  warning_count: number
  domains_with_restrictions: string[]
  average_delay: number
}

export type ComplianceLevel = 'strict' | 'moderate' | 'permissive'

export class ComplianceManager {
  private baseUrl = '/api/compliance'

  /**
   * URLのコンプライアンスをチェック
   */
  async checkCompliance(
    url: string, 
    complianceLevel: ComplianceLevel = 'moderate'
  ): Promise<ComplianceCheck> {
    try {
      const response = await SecureHttpClient.fetch(`${this.baseUrl}/check`, {
        method: 'POST',
        body: JSON.stringify({
          url,
          compliance_level: complianceLevel
        })
      })

      if (!response.ok) {
        throw new Error(`コンプライアンスチェック失敗: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Compliance check error:', error)
      throw error
    }
  }

  /**
   * サイトポリシーを取得
   */
  async getSitePolicy(domain: string): Promise<SitePolicy> {
    try {
      // ドメインをエンコード
      const encodedDomain = encodeURIComponent(domain)
      
      const response = await SecureHttpClient.fetch(
        `${this.baseUrl}/site-policy/${encodedDomain}`
      )

      if (!response.ok) {
        throw new Error(`サイトポリシー取得失敗: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Site policy fetch error:', error)
      throw error
    }
  }

  /**
   * 複数URLの一括コンプライアンスチェック
   */
  async batchCheckCompliance(
    urls: string[], 
    _complianceLevel: ComplianceLevel = 'moderate'
  ): Promise<{ results: ComplianceCheck[] }> {
    try {
      const response = await SecureHttpClient.fetch(`${this.baseUrl}/batch-check`, {
        method: 'POST',
        body: JSON.stringify(urls),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`バッチチェック失敗: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Batch compliance check error:', error)
      throw error
    }
  }

  /**
   * コンプライアンス統計を取得
   */
  async getStats(): Promise<ComplianceStats> {
    try {
      const response = await SecureHttpClient.fetch(`${this.baseUrl}/stats`)

      if (!response.ok) {
        throw new Error(`統計取得失敗: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Compliance stats error:', error)
      throw error
    }
  }

  /**
   * リクエスト結果を記録
   */
  async recordRequestResult(url: string, success: boolean): Promise<void> {
    try {
      await SecureHttpClient.fetch(`${this.baseUrl}/record-result`, {
        method: 'POST',
        body: JSON.stringify({ url, success })
      })
    } catch (error) {
      console.error('Record request result error:', error)
      // エラーを無視（統計目的のため）
    }
  }

  /**
   * 推奨HTTPヘッダーを取得
   */
  async getRecommendedHeaders(domain: string): Promise<Record<string, string>> {
    try {
      const encodedDomain = encodeURIComponent(domain)
      
      const response = await SecureHttpClient.fetch(
        `${this.baseUrl}/recommended-headers/${encodedDomain}`
      )

      if (!response.ok) {
        throw new Error(`推奨ヘッダー取得失敗: ${response.status}`)
      }

      const result = await response.json()
      return result.recommended_headers
    } catch (error) {
      console.error('Recommended headers error:', error)
      throw error
    }
  }
}

/**
 * コンプライアンス警告コンポーネント用のユーティリティ
 */
export class ComplianceWarningHelper {
  static getSeverityLevel(check: ComplianceCheck): 'error' | 'warning' | 'info' {
    if (!check.allowed || check.errors.length > 0) {
      return 'error'
    }
    if (check.warnings.length > 0) {
      return 'warning'
    }
    return 'info'
  }

  static getSeverityColor(severity: 'error' | 'warning' | 'info'): string {
    switch (severity) {
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200'
    }
  }

  static getSeverityIcon(severity: 'error' | 'warning' | 'info'): string {
    switch (severity) {
      case 'error':
        return `<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>`
      case 'warning':
        return `<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
        </svg>`
      case 'info':
        return `<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>`
    }
  }

  static formatDelay(seconds: number): string {
    if (seconds < 1) {
      return '即座'
    } else if (seconds < 60) {
      return `${seconds}秒`
    } else {
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      return remainingSeconds > 0 
        ? `${minutes}分${remainingSeconds}秒`
        : `${minutes}分`
    }
  }

  static getComplianceSummary(check: ComplianceCheck): string {
    if (!check.allowed) {
      return 'アクセス禁止'
    }
    
    const issueCount = check.warnings.length + check.errors.length
    if (issueCount === 0) {
      return 'コンプライアンス適合'
    }
    
    return `${issueCount}件の注意事項`
  }
}

/**
 * コンプライアンスチェック結果の表示フック
 */
export function useComplianceDisplay(check: ComplianceCheck | null) {
  if (!check) {
    return null
  }

  const severity = ComplianceWarningHelper.getSeverityLevel(check)
  const color = ComplianceWarningHelper.getSeverityColor(severity)
  const summary = ComplianceWarningHelper.getComplianceSummary(check)
  const formattedDelay = ComplianceWarningHelper.formatDelay(check.delay_seconds)

  return {
    severity,
    color,
    summary,
    formattedDelay,
    hasIssues: check.warnings.length > 0 || check.errors.length > 0,
    isBlocked: !check.allowed
  }
}

// シングルトンインスタンス
export const complianceManager = new ComplianceManager() 