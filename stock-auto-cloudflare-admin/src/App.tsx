import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { DashboardHeader } from './components/layout/DashboardHeader'
import { BottomNavigation } from './components/layout/BottomNavigation'

export default function App() {
  const { isAuth, loading, login, logout: _logout } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-text-muted">로딩 중...</span>
        </div>
      </div>
    )
  }

  if (!isAuth) {
    return <Login onLogin={login} />
  }

  return (
    <div className="min-h-screen bg-surface">
      <DashboardHeader />
      <main className="max-w-5xl mx-auto px-4 pt-4 pb-24">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'portfolio' && (
          <div className="flex items-center justify-center h-48 text-text-muted text-sm">
            Portfolio view coming soon
          </div>
        )}
        {activeTab === 'strategy' && (
          <div className="flex items-center justify-center h-48 text-text-muted text-sm">
            Strategy view coming soon
          </div>
        )}
        {activeTab === 'logs' && (
          <div className="flex items-center justify-center h-48 text-text-muted text-sm">
            Logs view coming soon
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="flex items-center justify-center h-48 text-text-muted text-sm">
            Settings view coming soon
          </div>
        )}
      </main>
      <BottomNavigation active={activeTab} onChange={setActiveTab} />
    </div>
  )
}
