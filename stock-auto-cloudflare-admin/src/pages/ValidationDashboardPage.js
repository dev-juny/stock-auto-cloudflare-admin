import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { Card } from '../components/common/Card';
import { CardSkeleton } from '../components/common/Skeleton';
import { Badge } from '../components/common/Badge';
import { Tooltip } from '../components/common/Tooltip';
import { createChart, ColorType, LineSeries, HistogramSeries } from 'lightweight-charts';
import { findGlossary } from '../utils/glossary';
import { Activity, TrendingUp, TrendingDown, Target, BarChart3, RefreshCw, XCircle, } from 'lucide-react';
import { formatKST } from '../utils/kst';
export default function ValidationDashboardPage() {
    const [data, setData] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const sharpeRef = useRef(null);
    const mddRef = useRef(null);
    const pfRef = useRef(null);
    const wrRef = useRef(null);
    async function loadAll() {
        setLoading(true);
        setError(null);
        try {
            const [val, adv] = await Promise.all([
                api.get('/api/validation/status'),
                api.get('/api/validation/dashboard'),
            ]);
            setData(val);
            setDashboard(adv);
        }
        catch (e) {
            setError(e.message || 'Failed to load validation data');
        }
        setLoading(false);
    }
    useEffect(() => { loadAll(); }, []);
    // Charts
    useEffect(() => {
        if (!dashboard || loading)
            return;
        const charts = [];
        const am = dashboard.advanced_metrics || {};
        const opts = {
            layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#9CA3AF', fontSize: 10 },
            grid: { vertLines: { color: '#1F2937' }, horzLines: { color: '#1F2937' } },
            rightPriceScale: { borderColor: '#1F2937', scaleMargins: { top: 0.1, bottom: 0.1 } },
            timeScale: { borderColor: '#1F2937', visible: false },
            width: 0, height: 80,
            handleScroll: false, handleScale: false,
            autoSize: true,
        };
        if (sharpeRef.current && am.rolling_sharpe_series?.length > 0) {
            const ch = createChart(sharpeRef.current, { ...opts });
            const s = ch.addSeries(LineSeries, { color: '#22C55E', lineWidth: 2 });
            s.setData(am.rolling_sharpe_series.map((v, i) => ({ time: String(i), value: v })));
            charts.push(ch);
        }
        if (mddRef.current && am.rolling_mdd_series?.length > 0) {
            const ch = createChart(mddRef.current, { ...opts });
            const s = ch.addSeries(HistogramSeries, { color: '#EF4444' });
            s.setData(am.rolling_mdd_series.map((v, i) => ({ time: String(i), value: Math.min(v, 0) })));
            charts.push(ch);
        }
        if (pfRef.current && am.rolling_pf_series?.length > 0) {
            const ch = createChart(pfRef.current, { ...opts });
            const s = ch.addSeries(LineSeries, { color: '#3B82F6', lineWidth: 2 });
            s.setData(am.rolling_pf_series.map((v, i) => ({ time: String(i), value: Math.min(v, 10) })));
            charts.push(ch);
        }
        if (wrRef.current && am.rolling_win_rate_series?.length > 0) {
            const ch = createChart(wrRef.current, { ...opts });
            const s = ch.addSeries(LineSeries, { color: '#A78BFA', lineWidth: 2 });
            s.setData(am.rolling_win_rate_series.map((v, i) => ({ time: String(i), value: v })));
            charts.push(ch);
        }
        return () => charts.forEach(c => c.remove());
    }, [dashboard, loading]);
    if (loading) {
        return (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "skeleton h-5 w-32" }), _jsx("div", { className: "grid grid-cols-2 gap-3", children: [1, 2, 3, 4].map(i => _jsx(CardSkeleton, {}, i)) })] }));
    }
    if (error) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center h-48 gap-3", children: [_jsx(XCircle, { size: 24, className: "text-red-400" }), _jsx("p", { className: "text-xs text-text-muted", children: error }), _jsx("button", { onClick: loadAll, className: "text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20", children: "Retry" })] }));
    }
    const isActive = data?.is_active ?? dashboard?.active ?? false;
    const startedAt = data?.started_at || dashboard?.started_at || '';
    const elapsedDays = dashboard?.progress?.elapsed_days ?? 0;
    const metrics = dashboard?.metrics;
    const am = dashboard?.advanced_metrics;
    const hasSharpe = (am?.rolling_sharpe_series?.length ?? 0) > 0;
    const hasMdd = (am?.rolling_mdd_series?.length ?? 0) > 0;
    const hasPf = (am?.rolling_pf_series?.length ?? 0) > 0;
    const hasWr = (am?.rolling_win_rate_series?.length ?? 0) > 0;
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 justify-end", children: [_jsx(Badge, { variant: isActive ? 'success' : 'muted', children: isActive ? 'ACTIVE' : 'INACTIVE' }), _jsx("button", { onClick: loadAll, className: "p-2 text-text-muted hover:text-text", children: _jsx(RefreshCw, { size: 14 }) })] }), _jsxs(Card, { children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx(Activity, { size: 16, className: isActive ? 'text-green-400' : 'text-text-muted' }), _jsx("span", { className: "text-sm font-semibold text-text", children: "Validation Status" }), startedAt && _jsxs("span", { className: "text-[10px] text-text-muted", children: ["since ", formatKST(startedAt)] })] }), isActive && (_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx("div", { className: "flex-1 h-2 bg-surface rounded-full overflow-hidden", children: _jsx("div", { className: "h-full rounded-full bg-green-400 transition-all", style: { width: `${Math.min(elapsedDays / 30 * 100, 100)}%` } }) }), _jsxs("span", { className: "text-xs text-text-muted tabular-nums", children: [elapsedDays.toFixed(0), "/30 days"] })] })), _jsxs("div", { className: "grid grid-cols-3 gap-3 text-xs", children: [_jsxs("div", { className: "bg-surface rounded-xl p-3 text-center", children: [_jsx(Tooltip, { content: findGlossary('return')?.description ?? 'Total Return', children: _jsx("div", { className: "text-text-muted text-[10px]", children: "Total Return" }) }), _jsxs("div", { className: `font-bold text-sm ${(metrics?.cumulative_return ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [(metrics?.cumulative_return ?? 0) >= 0 ? '+' : '', (metrics?.cumulative_return ?? 0).toFixed(2), "%"] })] }), _jsxs("div", { className: "bg-surface rounded-xl p-3 text-center", children: [_jsx(Tooltip, { content: findGlossary('mdd')?.description ?? 'MDD', children: _jsx("div", { className: "text-text-muted text-[10px]", children: "MDD" }) }), _jsxs("div", { className: "font-bold text-sm text-red-400", children: [(metrics?.max_drawdown ?? 0).toFixed(1), "%"] })] }), _jsxs("div", { className: "bg-surface rounded-xl p-3 text-center", children: [_jsx(Tooltip, { content: findGlossary('winRate')?.description ?? 'Win Rate', children: _jsx("div", { className: "text-text-muted text-[10px]", children: "Win Rate" }) }), _jsxs("div", { className: "font-bold text-sm text-blue-400", children: [(metrics?.win_rate ?? 0).toFixed(1), "%"] })] })] })] }), dashboard && metrics && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [_jsxs(Card, { children: [_jsxs("div", { className: "flex items-center gap-1 text-text-muted mb-1", children: [_jsx(BarChart3, { size: 12 }), _jsx(Tooltip, { content: findGlossary('sharpe')?.description ?? 'Sharpe', children: _jsx("span", { className: "text-[10px]", children: "Sharpe" }) })] }), _jsx("div", { className: `text-lg font-bold font-mono tabular-nums ${(metrics.sharpe ?? 0) >= 1 ? 'text-green-400' : (metrics.sharpe ?? 0) >= 0 ? 'text-amber-400' : 'text-red-400'}`, children: (metrics.sharpe ?? 0).toFixed(2) })] }), _jsxs(Card, { children: [_jsxs("div", { className: "flex items-center gap-1 text-text-muted mb-1", children: [_jsx(TrendingUp, { size: 12 }), _jsx("span", { className: "text-[10px]", children: "Alpha" })] }), _jsxs("div", { className: `text-lg font-bold font-mono tabular-nums ${(am?.alpha ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [(am?.alpha ?? 0) >= 0 ? '+' : '', (am?.alpha ?? 0).toFixed(4)] })] }), _jsxs(Card, { children: [_jsxs("div", { className: "flex items-center gap-1 text-text-muted mb-1", children: [_jsx(TrendingDown, { size: 12 }), _jsx("span", { className: "text-[10px]", children: "Beta" })] }), _jsx("div", { className: "text-lg font-bold font-mono tabular-nums text-text", children: (am?.beta ?? 0).toFixed(4) })] }), _jsxs(Card, { children: [_jsxs("div", { className: "flex items-center gap-1 text-text-muted mb-1", children: [_jsx(Target, { size: 12 }), _jsx(Tooltip, { content: findGlossary('profitFactor')?.description ?? 'Profit Factor', children: _jsx("span", { className: "text-[10px]", children: "Profit Factor" }) })] }), _jsx("div", { className: `text-lg font-bold font-mono tabular-nums ${metrics.profit_factor >= 1.5 ? 'text-green-400' : 'text-text'}`, children: (metrics.profit_factor ?? 0) === Infinity ? '∞' : (metrics.profit_factor ?? 0).toFixed(2) })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3", children: [hasSharpe && (_jsxs(Card, { children: [_jsx("h3", { className: "text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2", children: "Rolling Sharpe" }), _jsx("div", { ref: sharpeRef, className: "w-full", style: { height: 100 } })] })), hasMdd && (_jsxs(Card, { children: [_jsx("h3", { className: "text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2", children: "Rolling MDD" }), _jsx("div", { ref: mddRef, className: "w-full", style: { height: 100 } })] })), hasPf && (_jsxs(Card, { children: [_jsx("h3", { className: "text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2", children: "Rolling PF" }), _jsx("div", { ref: pfRef, className: "w-full", style: { height: 100 } })] })), hasWr && (_jsxs(Card, { children: [_jsx("h3", { className: "text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2", children: "Rolling Win Rate" }), _jsx("div", { ref: wrRef, className: "w-full", style: { height: 100 } })] }))] }), dashboard.monthly_heatmap && Object.keys(dashboard.monthly_heatmap).length > 0 && (_jsxs(Card, { children: [_jsx("h3", { className: "text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2", children: "Monthly Returns" }), _jsx("div", { className: "grid grid-cols-3 sm:grid-cols-6 gap-1.5", children: Object.entries(dashboard.monthly_heatmap).flatMap(([year, months]) => Object.entries(months).map(([month, ret]) => (_jsxs("div", { className: `px-2 py-1.5 rounded-lg text-center text-xs font-mono tabular-nums ${ret >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`, children: [_jsxs("div", { className: "text-[9px] text-text-muted", children: [year, ".", month] }), _jsxs("div", { className: "font-bold", children: [ret >= 0 ? '+' : '', ret.toFixed(1), "%"] })] }, `${year}-${month}`)))) })] })), dashboard.daily_logs && dashboard.daily_logs.length > 0 && (_jsxs(Card, { children: [_jsx("h3", { className: "text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2", children: "Daily Log" }), _jsx("div", { className: "max-h-40 overflow-y-auto space-y-1", children: [...dashboard.daily_logs].reverse().map(log => (_jsxs("div", { className: "flex items-center justify-between bg-surface rounded-lg px-2.5 py-1.5 text-xs", children: [_jsx("span", { className: "text-text-muted text-[10px]", children: log.date }), _jsxs("div", { className: "flex gap-3", children: [_jsxs("span", { className: log.daily_return >= 0 ? 'text-green-400' : 'text-red-400', children: [log.daily_return >= 0 ? '+' : '', log.daily_return.toFixed(2), "%"] }), _jsxs("span", { className: "text-text", children: [log.cumulative_return.toFixed(2), "%"] }), _jsxs("span", { className: "text-blue-400", children: [log.win_rate.toFixed(1), "%"] })] })] }, log.date))) })] }))] }))] }));
}
