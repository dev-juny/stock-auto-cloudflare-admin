import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { EvolutionPage } from './pages/Evolution'
import PortfolioPage from './pages/PortfolioPage'
import StrategiesPage from './pages/StrategiesPage'
import PaperTradingPage from './pages/PaperTradingPage'
import LogsPage from './pages/LogsPage'
import SettingsPage from './pages/SettingsPage'
import SchedulerPage from './pages/scheduler/SchedulerPage'
import RiskPage from './pages/RiskPage'
import ValidationDashboardPage from './pages/ValidationDashboardPage'
import { DashboardHeader } from './components/layout/DashboardHeader'
import { BottomNavigation } from './components/layout/BottomNavigation'
import { ToastProvider } from './components/common/Toast'

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
    <ToastProvider>
      <div className="min-h-screen bg-surface">
        <DashboardHeader />
        <main className="max-w-5xl mx-auto px-4 pt-4 pb-28 safe-area-bottom">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'portfolio' && <PortfolioPage />}
          {activeTab === 'evolution' && <EvolutionPage />}
        {activeTab === 'strategy' && <StrategiesPage />}
        {activeTab === 'paper-trading' && <PaperTradingPage />}
          {activeTab === 'logs' && <LogsPage />}
          {activeTab === 'settings' && <SettingsPage />}
          {activeTab === 'scheduler' && <SchedulerPage />}
          {activeTab === 'risk' && <RiskPage />}
          {activeTab === 'validation' && <ValidationDashboardPage />}
      </main>
        <BottomNavigation active={activeTab} onChange={setActiveTab} />
      </div>
    </ToastProvider>
  )
}
