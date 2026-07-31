import { useState, useCallback, lazy, Suspense } from 'react'
import { useAuth } from './hooks/useAuth'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
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
import { NavigationContext } from './hooks/useNavigation'

const EvolutionPage = lazy(() => import('./pages/Evolution').then(m => ({ default: m.EvolutionPage })))
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'))
const StrategiesPage = lazy(() => import('./pages/StrategiesPage'))
const PaperTradingPage = lazy(() => import('./pages/PaperTradingPage'))
const LogsPage = lazy(() => import('./pages/LogsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const SchedulerPage = lazy(() => import('./pages/scheduler/SchedulerPage'))
const RiskPage = lazy(() => import('./pages/RiskPage'))
const ValidationDashboardPage = lazy(() => import('./pages/ValidationDashboardPage'))
const ProductionDashboard = lazy(() => import('./pages/ProductionDashboard'))
const PipelinePage = lazy(() => import('./pages/PipelinePage'))

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

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
    <NavigationContext.Provider value={{ navigate: setActiveTab }}>
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
          <Suspense fallback={<PageFallback />}>
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
            {activeTab === 'production' && <ProductionDashboard />}
            {activeTab === 'pipeline' && <PipelinePage />}
          </Suspense>
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
    </NavigationContext.Provider>
  )
}
