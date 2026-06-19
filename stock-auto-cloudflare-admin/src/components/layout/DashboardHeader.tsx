import { LogOut } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

export function DashboardHeader() {
  const { logout } = useAuth()

  return (
    <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-surface-border">
      <div className="flex items-center justify-between max-w-5xl mx-auto px-4 h-12">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xs">
            JJ
          </div>
          <h1 className="text-sm font-semibold text-text-primary">제이제이 연구소</h1>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-text-muted hover:text-text-primary transition-colors min-h-[44px] px-2"
        >
          <LogOut size={16} />
          <span className="text-xs hidden sm:inline">로그아웃</span>
        </button>
      </div>
    </header>
  )
}
