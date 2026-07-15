import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, lazy, Suspense } from 'react';
import { useAuth } from './hooks/useAuth';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { DashboardHeader } from './components/layout/DashboardHeader';
import { BottomNavigation } from './components/layout/BottomNavigation';
import { ToastProvider } from './components/common/Toast';
import { TourOverlay } from './components/common/TourOverlay';
import { useTour } from './hooks/useTour';
import { HelpCircle } from 'lucide-react';
import { PAGE_INFO } from './utils/pageInfo';
import { HELP_CONTENT } from './utils/helpContent';
import { HelpDrawer } from './components/common/HelpDrawer';
import { InfoBanner } from './components/common/InfoBanner';
const EvolutionPage = lazy(() => import('./pages/Evolution').then(m => ({ default: m.EvolutionPage })));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const StrategiesPage = lazy(() => import('./pages/StrategiesPage'));
const PaperTradingPage = lazy(() => import('./pages/PaperTradingPage'));
const LogsPage = lazy(() => import('./pages/LogsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SchedulerPage = lazy(() => import('./pages/scheduler/SchedulerPage'));
const RiskPage = lazy(() => import('./pages/RiskPage'));
const ValidationDashboardPage = lazy(() => import('./pages/ValidationDashboardPage'));
const ProductionDashboard = lazy(() => import('./pages/ProductionDashboard'));
function PageFallback() {
    return (_jsx("div", { className: "flex items-center justify-center py-12", children: _jsx("div", { className: "w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" }) }));
}
export default function App() {
    const { isAuth, loading, login, logout: _logout } = useAuth();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [helpOpen, setHelpOpen] = useState(false);
    const [helpContent, setHelpContent] = useState(null);
    const tour = useTour();
    const openHelp = useCallback(() => {
        const info = PAGE_INFO[activeTab];
        if (!info)
            return;
        const content = HELP_CONTENT[info.helpKey];
        if (!content)
            return;
        setHelpContent(content);
        setHelpOpen(true);
    }, [activeTab]);
    if (loading) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-surface", children: _jsxs("div", { className: "flex flex-col items-center gap-3", children: [_jsx("div", { className: "w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" }), _jsx("span", { className: "text-sm text-text-muted", children: "\uB85C\uB529 \uC911..." })] }) }));
    }
    if (!isAuth) {
        return _jsx(Login, { onLogin: login });
    }
    return (_jsxs(ToastProvider, { children: [_jsxs("div", { className: "min-h-screen bg-surface", children: [_jsx(DashboardHeader, {}), _jsxs("main", { className: "max-w-5xl mx-auto px-4 pt-4 pb-28 safe-area-bottom", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("h2", { className: "text-lg font-bold text-text", children: PAGE_INFO[activeTab]?.title ?? activeTab }), _jsxs("div", { className: "flex items-center gap-2", children: [!tour.dismissed && !tour.active && (_jsx("button", { onClick: tour.start, className: "flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors", children: "\uD83C\uDF93 \uB458\uB7EC\uBCF4\uAE30" })), _jsxs("button", { onClick: openHelp, className: "flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-surface text-text-muted hover:text-text transition-colors", children: [_jsx(HelpCircle, { size: 12 }), " \uB3C4\uC6C0\uB9D0"] })] })] }), PAGE_INFO[activeTab]?.description && (_jsx(InfoBanner, { title: PAGE_INFO[activeTab].title, description: PAGE_INFO[activeTab].description })), _jsxs(Suspense, { fallback: _jsx(PageFallback, {}), children: [activeTab === 'dashboard' && _jsx(Dashboard, {}), activeTab === 'portfolio' && _jsx(PortfolioPage, {}), activeTab === 'evolution' && _jsx(EvolutionPage, {}), activeTab === 'strategy' && _jsx(StrategiesPage, {}), activeTab === 'paper-trading' && _jsx(PaperTradingPage, {}), activeTab === 'logs' && _jsx(LogsPage, {}), activeTab === 'settings' && _jsx(SettingsPage, {}), activeTab === 'scheduler' && _jsx(SchedulerPage, {}), activeTab === 'risk' && _jsx(RiskPage, {}), activeTab === 'validation' && _jsx(ValidationDashboardPage, {}), activeTab === 'production' && _jsx(ProductionDashboard, {})] })] }), _jsx(BottomNavigation, { active: activeTab, onChange: setActiveTab })] }), helpContent && (_jsx(HelpDrawer, { content: helpContent, open: helpOpen, onClose: () => setHelpOpen(false) })), tour.active && tour.step && (_jsx(TourOverlay, { step: tour.step, currentStep: tour.currentStep, totalSteps: tour.totalSteps, onNext: tour.next, onPrev: tour.prev, onFinish: tour.finish }))] }));
}
