import { useState, useCallback } from 'react'
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
import { TourOverlay } from './components/common/TourOverlay'
import { useTour } from './hooks/useTour'
import { HelpCircle } from 'lucide-react'
import { PAGE_INFO } from './utils/pageInfo'
import { HELP_CONTENT } from './utils/helpContent'
import type { HelpContent } from './utils/helpContent'
import { HelpDrawer } from './components/common/HelpDrawer'
import { InfoBanner } from './components/common/InfoBanner'

export default function App() {
  const { isAuth, loading, login, logout: _logout } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpContent, setHelpContent] = useState<HelpContent | null>(null)
  const tour = useTour()

  const openHelp = useCallback(() => {
    const info = PAGE_INFO[activeTab]
    if (!info) return
    const content = HELP_CONTENT[info.helpKey]
    if (!content) return
    setHelpContent(content)
    setHelpOpen(true)
  }, [activeTab])

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
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-text">{PAGE_INFO[activeTab]?.title ?? activeTab}</h2>
            <div className="flex items-center gap-2">
              {!tour.dismissed && !tour.active && (
                <button onClick={tour.start}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                  🎓 둘러보기
                </button>
              )}
              <button onClick={openHelp}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-surface text-text-muted hover:text-text transition-colors">
                <HelpCircle size={12} /> 도움말
              </button>
            </div>
          </div>
          {PAGE_INFO[activeTab]?.description && (
            <InfoBanner title={PAGE_INFO[activeTab].title} description={PAGE_INFO[activeTab].description} />
          )}
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

      {helpContent && (
        <HelpDrawer content={helpContent} open={helpOpen} onClose={() => setHelpOpen(false)} />
      )}

      {tour.active && tour.step && (
        <TourOverlay
          step={tour.step}
          currentStep={tour.currentStep}
          totalSteps={tour.totalSteps}
          onNext={tour.next}
          onPrev={tour.prev}
          onFinish={tour.finish}
        />
      )}
    </ToastProvider>
  )
}
