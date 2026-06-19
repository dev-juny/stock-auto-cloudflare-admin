import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { KPICards } from '../components/dashboard/KPICards';
import { SystemStatusCard } from '../components/dashboard/SystemStatusCard';
import { PortfolioCard } from '../components/dashboard/PortfolioCard';
import { StrategyCard } from '../components/dashboard/StrategyCard';
import { PositionsCard } from '../components/dashboard/PositionsCard';
import { TradeHistory } from '../components/dashboard/TradeHistory';
import { LogViewer } from '../components/dashboard/LogViewer';
import { useHealth } from '../hooks/useHealth';
import { useBalance } from '../hooks/useBalance';
export function Dashboard() {
    const { status: systemStatus, loading: healthLoading, refetch: refetchHealth } = useHealth();
    const { data: portfolio, loading: portfolioLoading } = useBalance();
    return (_jsxs("div", { className: "space-y-3 pb-24", children: [_jsx(KPICards, { portfolio: portfolio, loading: portfolioLoading }), _jsx(SystemStatusCard, { status: systemStatus, loading: healthLoading, onRefresh: refetchHealth }), _jsx(PortfolioCard, { data: portfolio, loading: portfolioLoading }), _jsx(PositionsCard, {}), _jsx(StrategyCard, {}), _jsx(TradeHistory, {}), _jsx(LogViewer, {})] }));
}
