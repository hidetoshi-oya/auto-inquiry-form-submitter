import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { authService } from '../services/auth'
import { LoadingSpinner } from './ui/LoadingSpinner'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * 認証が必要なルートを保護するコンポーネント
 * 認証されていない場合はログインページにリダイレクト
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const location = useLocation()

  useEffect(() => {
    const checkAuth = async () => {
      if (!authService.isAuthenticated()) {
        setIsAuthenticated(false)
        return
      }

      try {
        // トークンの有効性を検証
        const isValid = await authService.validateToken()
        setIsAuthenticated(isValid)
      } catch (error) {
        console.error('Auth validation error:', error)
        setIsAuthenticated(false)
      }
    }

    checkAuth()
  }, [])

  // 認証チェック中はローディング表示
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  // 認証されていない場合はログインページにリダイレクト
  // 現在のパスをstateに保存して、ログイン後に戻れるようにする
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 認証されている場合は子コンポーネントを表示
  return <>{children}</>
}

export default ProtectedRoute