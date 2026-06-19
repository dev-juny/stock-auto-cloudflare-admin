import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { EvolutionPage } from './pages/Evolution';
import PortfolioPage from './pages/PortfolioPage';
import StrategiesPage from './pages/StrategiesPage';
import LogsPage from './pages/LogsPage';
import SettingsPage from './pages/SettingsPage';
import SchedulerPage from './pages/scheduler/SchedulerPage';
import { DashboardHeader } from './components/layout/DashboardHeader';
import { BottomNavigation } from './components/layout/BottomNavigation';
export default function App() {
    const { isAuth, loading, login, logout: _logout } = useAuth();
    const [activeTab, setActiveTab] = useState('dashboard');
    if (loading) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-surface", children: _jsxs("div", { className: "flex flex-col items-center gap-3", children: [_jsx("div", { className: "w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" }), _jsx("span", { className: "text-sm text-text-muted", children: "\uB85C\uB529 \uC911..." })] }) }));
    }
    if (!isAuth) {
        return _jsx(Login, { onLogin: login });
    }
    return (_jsxs("div", { className: "min-h-screen bg-surface", children: [_jsx(DashboardHeader, {}), _jsxs("main", { className: "max-w-5xl mx-auto px-4 pt-4 pb-24", children: [activeTab === 'dashboard' && _jsx(Dashboard, {}), activeTab === 'portfolio' && _jsx(PortfolioPage, {}), activeTab === 'evolution' && _jsx(EvolutionPage, {}), activeTab === 'strategy' && _jsx(StrategiesPage, {}), activeTab === 'logs' && _jsx(LogsPage, {}), activeTab === 'settings' && _jsx(SettingsPage, {}), activeTab === 'scheduler' && _jsx(SchedulerPage, {})] }), _jsx(BottomNavigation, { active: activeTab, onChange: setActiveTab })] }));
}
