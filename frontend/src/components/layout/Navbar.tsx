import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { authService } from '@/services/auth'
import { User as UserType } from '@/types/models'

export function Navbar() {
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<UserType | null>(null)

  // ユーザー情報を取得
  useEffect(() => {
    const user = authService.getStoredUser()
    setCurrentUser(user)
  }, [])

  // ログアウト処理
  const handleLogout = () => {
    authService.logout()
  }

  const navigation = [
    { name: 'ダッシュボード', path: '/' },
    { name: '企業管理', path: '/companies' },
    { name: 'フォーム検出', path: '/forms' },
    { name: '送信履歴', path: '/submissions' },
    { name: 'スケジュール', path: '/schedules' },
    { name: 'テンプレート', path: '/templates' },
    { name: 'タスク管理', path: '/tasks' },
  ]

  const NavButton = ({ item }: { item: { name: string; path: string } }) => {
    const isActive = location.pathname === item.path
    return (
      <Button
        variant={isActive ? 'default' : 'ghost'}
        size="sm"
        asChild
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <Link to={item.path}>
          {item.name}
        </Link>
      </Button>
    )
  }

  return (
    <nav className="bg-background border-b border-border shadow-sm">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* ロゴエリア */}
          <div className="flex-shrink-0">
            <Link to="/" className="block">
              <span className="text-lg font-bold text-foreground truncate max-w-[200px]">
                <span className="hidden sm:inline">
                  Auto Inquiry Form Submitter
                </span>
                <span className="sm:hidden">
                  AIFS
                </span>
              </span>
            </Link>
          </div>

          {/* デスクトップナビゲーション */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {navigation.map((item) => (
                <NavButton key={item.name} item={item} />
              ))}
            </div>
            
            {/* ユーザー情報・ログアウト */}
            <div className="flex items-center space-x-2 pl-4 border-l border-border">
              {currentUser && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{currentUser.username}</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4 mr-1" />
                ログアウト
              </Button>
            </div>
          </div>

          {/* モバイルメニューボタン */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">メニューを開く</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <nav className="flex flex-col space-y-4 mt-8">
                {/* ユーザー情報 */}
                {currentUser && (
                  <div className="flex items-center space-x-2 px-3 py-2 bg-muted/50 rounded-md">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{currentUser.username}</span>
                  </div>
                )}
                
                {/* ナビゲーションメニュー */}
                <div className="flex flex-col space-y-2">
                  {navigation.map((item) => (
                    <NavButton key={item.name} item={item} />
                  ))}
                </div>
                
                {/* ログアウトボタン */}
                <div className="pt-4 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="w-full justify-start text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    ログアウト
                  </Button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
} 