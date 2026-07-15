import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../utils/api';
import { useAction } from '../hooks/useAction';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Tooltip } from '../components/common/Tooltip';
import { findGlossary } from '../utils/glossary';
import { ArrowUpDown, RefreshCw, ChevronLeft, ChevronRight, TrendingUp, Target, CheckCircle, XCircle, Shield, AlertTriangle, BarChart3, Activity, Clock, } from 'lucide-react';
import { formatKST } from '../utils/kst';
const SORT_OPTIONS = [
    { label: 'Fitness', value: 'fitness' },
    { label: 'Return', value: 'return' },
    { label: 'Win Rate', value: 'win_rate' },
    { label: 'MDD', value: 'mdd' },
    { label: 'Generation', value: 'generation' },
];
function getMddColor(mdd) {
    if (mdd < 5)
        return 'text-green-400';
    if (mdd < 10)
        return 'text-amber-400';
    if (mdd < 20)
        return 'text-orange-400';
    return 'text-red-400';
}
function getMddBg(mdd) {
    if (mdd < 5)
        return 'bg-green-500/10';
    if (mdd < 10)
        return 'bg-amber-500/10';
    if (mdd < 20)
        return 'bg-orange-500/10';
    return 'bg-red-500/10';
}
export default function StrategiesPage() {
    const [data, setData] = useState(null);
    const [offset, setOffset] = useState(0);
    const [limit] = useState(20);
    const [sortBy, setSortBy] = useState('fitness');
    const [sortDir, setSortDir] = useState('desc');
    const [selectedStrategy, setSelectedStrategy] = useState(null);
    const [detailTab, setDetailTab] = useState('metrics');
    const [riskData, setRiskData] = useState(null);
    const [promotions, setPromotions] = useState([]);
    const [validation, setValidation] = useState(null);
    const [readiness, setReadiness] = useState(null);
    const [loadingExtra, setLoadingExtra] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);
    const { execute: addToPortfolioAction } = useAction();
    async function addToPortfolio(strategy) {
        await addToPortfolioAction(() => api.post('/api/portfolio/strategies', {
            strategy_id: strategy.strategy_id,
            generation: strategy.generation,
            allocation: 0,
            status: 'candidate',
        }), 'Added to portfolio');
    }
    const load = useCallback(async () => {
        try {
            const params = new URLSearchParams({
                offset: String(offset), limit: String(limit),
                sort_by: sortBy, sort_dir: sortDir,
            });
            const res = await api.get(`/api/strategies/top?${params}`);
            setData(res);
        }
        catch { }
    }, [offset, limit, sortBy, sortDir]);
    useEffect(() => { load(); }, [load]);
    const totalPages = data ? Math.ceil(data.total / limit) : 0;
    const currentPage = Math.floor(offset / limit) + 1;
    async function loadDetail(strategyId) {
        try {
            const d = await api.get(`/api/strategies/top/${strategyId}`);
            setSelectedStrategy(d);
            setDetailTab('metrics');
            setLoadingExtra(true);
            const [risk, promos, val, ready] = await Promise.allSettled([
                api.get('/api/risk/check').catch(() => null),
                api.get(`/api/portfolio/promotion-history?limit=5&strategy_id=${strategyId}`).catch(() => null),
                api.get('/api/validation/status').catch(() => null),
                api.get('/api/live-trading/readiness').catch(() => null),
            ]);
            if (risk.status === 'fulfilled')
                setRiskData(risk.value);
            else
                setRiskData(null);
            if (promos.status === 'fulfilled')
                setPromotions(promos.value?.items ?? []);
            else
                setPromotions([]);
            if (val.status === 'fulfilled')
                setValidation(val.value);
            else
                setValidation(null);
            if (ready.status === 'fulfilled')
                setReadiness(ready.value);
            else
                setReadiness(null);
            setLoadingExtra(false);
        }
        catch (e) {
            console.error(e);
        }
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-start gap-2 text-[10px] text-text-muted bg-surface-card rounded-xl px-3 py-2 border border-surface-border", children: [_jsx(Target, { size: 12, className: "mt-0.5 shrink-0" }), _jsx("span", { className: "leading-relaxed", children: "Filters: Fitness \u2265 50 \u00B7 Win Rate \u2265 45% \u00B7 Trades \u2265 30 \u00B7 MDD \u2264 20% \u00B7 Return \u2265 20%" }), _jsx("button", { onClick: load, className: "p-1 ml-auto text-text-muted hover:text-text transition-colors shrink-0", children: _jsx(RefreshCw, { size: 12 }) })] }), _jsx("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: !data?.items ? (_jsx("div", { className: "p-6 text-center text-xs text-text-muted", children: "Loading..." })) : data.items.length === 0 ? (_jsx("div", { className: "p-6 text-center text-xs text-text-muted", children: "No strategies meet the criteria" })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "-mx-4 sm:mx-0 overflow-x-auto", children: _jsxs("table", { className: "w-full text-[10px] sm:text-xs", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-text-muted border-b border-surface-border", children: [_jsx("th", { className: "text-left px-1.5 sm:px-3 py-2 font-medium", children: _jsxs("button", { onClick: () => { setSortBy('generation'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }, className: `flex items-center gap-0.5 sm:gap-1 hover:text-text transition-colors ${sortBy === 'generation' ? 'text-primary' : ''}`, children: ["Gen ", _jsx(ArrowUpDown, { size: 8 })] }) }), SORT_OPTIONS.filter(o => o.value !== 'generation').map(o => {
                                                    const labelKey = o.value === 'return' ? 'return' : o.value === 'win_rate' ? 'winRate' : o.value;
                                                    return (_jsx("th", { className: "text-right px-1 sm:px-2 py-2 font-medium", children: _jsxs("button", { onClick: () => { setSortBy(o.value); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }, className: `flex items-center gap-0.5 sm:gap-1 ml-auto hover:text-text transition-colors ${sortBy === o.value ? 'text-primary' : ''}`, children: [_jsx(Tooltip, { content: findGlossary(labelKey)?.description ?? o.label, children: _jsx("span", { children: o.label }) }), _jsx(ArrowUpDown, { size: 8 })] }) }, o.value));
                                                }), _jsx("th", { className: "text-right px-1 sm:px-2 py-2 font-medium", children: _jsx(Tooltip, { content: findGlossary('mdd')?.description ?? 'MDD', children: _jsx("span", { children: "MDD" }) }) }), _jsx("th", { className: "text-right px-1 sm:px-2 py-2 font-medium whitespace-nowrap", children: _jsx(Tooltip, { content: findGlossary('totalTrades')?.description ?? 'Trades', children: _jsx("span", { children: "Trades" }) }) }), _jsx("th", { className: "text-right px-1 sm:px-2 py-2 font-medium whitespace-nowrap", children: "Action" })] }) }), _jsx("tbody", { className: "divide-y divide-surface-border", children: data.items.map(s => (_jsxs("tr", { className: "hover:bg-surface/50 transition-colors cursor-pointer", onClick: () => loadDetail(s.strategy_id), children: [_jsx("td", { className: "px-1.5 sm:px-3 py-2 text-text font-medium", children: s.generation }), _jsx("td", { className: "px-1 sm:px-2 py-2 text-right text-amber-400 whitespace-nowrap", children: s.fitness.toFixed(2) }), _jsxs("td", { className: `px-1 sm:px-2 py-2 text-right whitespace-nowrap ${s.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [s.return_pct >= 0 ? '+' : '', s.return_pct.toFixed(2), "%"] }), _jsxs("td", { className: "px-1 sm:px-2 py-2 text-right text-blue-400 whitespace-nowrap", children: [s.win_rate.toFixed(1), "%"] }), _jsxs("td", { className: `px-1 sm:px-2 py-2 text-right font-medium whitespace-nowrap ${getMddColor(s.mdd)}`, children: [s.mdd.toFixed(2), "%"] }), _jsx("td", { className: "px-1 sm:px-2 py-2 text-right text-text-muted", children: s.total_trades }), _jsx("td", { className: "px-1 sm:px-2 py-2 text-right", children: _jsx(AddToPortfolioButton, { strategy: s, onDone: load }) })] }, s.strategy_id))) })] }) }), _jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-t border-surface-border", children: [_jsxs("span", { className: "text-[11px] text-text-muted", children: [data.total, " total \u00B7 Page ", currentPage, " of ", totalPages || 1] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { disabled: offset === 0, onClick: () => setOffset(o => Math.max(0, o - limit)), className: "p-1.5 rounded-lg disabled:opacity-30 text-text-muted hover:text-text transition-colors", children: _jsx(ChevronLeft, { size: 14 }) }), _jsx("button", { disabled: offset + limit >= data.total, onClick: () => setOffset(o => o + limit), className: "p-1.5 rounded-lg disabled:opacity-30 text-text-muted hover:text-text transition-colors", children: _jsx(ChevronRight, { size: 14 }) })] })] })] })) }), selectedStrategy && (_jsx("div", { className: "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40", onClick: () => setSelectedStrategy(null), children: _jsxs("div", { className: "bg-surface-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "sticky top-0 bg-surface-card border-b border-surface-border px-4 py-3 flex items-center justify-between z-10", children: [_jsxs("h3", { className: "text-sm font-semibold text-text", children: ["Strategy #", selectedStrategy.strategy_id] }), _jsx("button", { onClick: () => setSelectedStrategy(null), className: "text-text-muted hover:text-text text-lg leading-none", children: "\u00D7" })] }), _jsx("div", { className: "flex border-b border-surface-border overflow-x-auto scrollbar-none", children: [
                                { id: 'metrics', label: '메트릭', icon: BarChart3 },
                                { id: 'risk', label: '리스크', icon: Shield },
                                { id: 'promotion', label: '승격', icon: TrendingUp },
                                { id: 'validation', label: '검증', icon: Activity },
                                { id: 'readiness', label: '준비도', icon: CheckCircle },
                            ].map(tab => (_jsxs("button", { onClick: () => setDetailTab(tab.id), className: `flex items-center gap-1 px-2 sm:gap-1.5 sm:px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-colors
                    ${detailTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-text-muted hover:text-text'}`, children: [_jsx(tab.icon, { size: 12 }), tab.label] }, tab.id))) }), _jsxs("div", { className: "p-3 sm:p-4 space-y-3 sm:space-y-4", children: [detailTab === 'metrics' && (_jsx(MetricsSection, { strategy: selectedStrategy, onAddToPortfolio: () => {
                                        addToPortfolio(selectedStrategy);
                                        setSelectedStrategy(null);
                                    } })), detailTab === 'risk' && (_jsx(RiskSection, { data: riskData, loading: loadingExtra, onRefresh: () => loadDetail(selectedStrategy.strategy_id) })), detailTab === 'promotion' && (_jsx(PromotionSection, { data: promotions, loading: loadingExtra, onRefresh: () => loadDetail(selectedStrategy.strategy_id) })), detailTab === 'validation' && (_jsx(ValidationSection, { data: validation, loading: loadingExtra, onRefresh: () => {
                                        loadDetail(selectedStrategy.strategy_id);
                                    } })), detailTab === 'readiness' && (_jsx(ReadinessSection, { data: readiness, loading: loadingExtra }))] })] }) })), confirmAction && (_jsx(ConfirmDialog, { open: true, title: confirmAction.title, message: confirmAction.message, variant: confirmAction.variant, onConfirm: () => { confirmAction.onConfirm(); setConfirmAction(null); }, onCancel: () => setConfirmAction(null) }))] }));
}
function SectionLoading() {
    return _jsx("div", { className: "text-xs text-text-muted text-center py-8", children: "Loading..." });
}
function SectionError({ message, onRetry }) {
    return (_jsxs("div", { className: "text-center py-6", children: [_jsx(AlertTriangle, { size: 20, className: "mx-auto mb-2 text-amber-400" }), _jsx("p", { className: "text-xs text-text-muted mb-2", children: message }), onRetry && (_jsx("button", { onClick: onRetry, className: "text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors", children: "Retry" }))] }));
}
function AddToPortfolioButton({ strategy, onDone }) {
    const { loading, execute } = useAction();
    const [added, setAdded] = useState(false);
    async function handleAdd() {
        await execute(() => api.post('/api/portfolio/strategies', {
            strategy_id: strategy.strategy_id,
            generation: strategy.generation,
            allocation: 0,
            status: 'candidate',
        }), 'Added to portfolio');
        setAdded(true);
        onDone();
    }
    return (_jsx("button", { onClick: (e) => { e.stopPropagation(); handleAdd(); }, disabled: loading || added, className: "text-[10px] px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50", children: added ? 'Added' : loading ? '...' : '+ Portfolio' }));
}
function MetricsSection({ strategy, onAddToPortfolio }) {
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs break-words", children: [_jsxs("div", { children: [_jsx(Tooltip, { content: findGlossary('generation')?.description ?? 'Generation', children: _jsx("span", { className: "text-text-muted", children: "Generation" }) }), _jsx("p", { className: "text-text font-medium", children: strategy.generation })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Version" }), _jsx("p", { className: "text-text font-medium", children: strategy.version })] }), _jsxs("div", { children: [_jsx(Tooltip, { content: findGlossary('fitness')?.description ?? 'Fitness', children: _jsx("span", { className: "text-text-muted", children: "Fitness" }) }), _jsx("p", { className: "text-amber-400 font-bold", children: strategy.fitness.toFixed(2) })] }), _jsxs("div", { children: [_jsx(Tooltip, { content: findGlossary('return')?.description ?? 'Return', children: _jsx("span", { className: "text-text-muted", children: "Return" }) }), _jsxs("p", { className: `font-bold ${strategy.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [strategy.return_pct >= 0 ? '+' : '', strategy.return_pct.toFixed(2), "%"] })] }), _jsxs("div", { children: [_jsx(Tooltip, { content: findGlossary('winRate')?.description ?? 'Win Rate', children: _jsx("span", { className: "text-text-muted", children: "Win Rate" }) }), _jsxs("p", { className: "text-blue-400 font-medium", children: [strategy.win_rate.toFixed(1), "%"] })] }), _jsxs("div", { children: [_jsx(Tooltip, { content: findGlossary('mdd')?.description ?? 'MDD', children: _jsx("span", { className: "text-text-muted", children: "MDD" }) }), _jsxs("p", { className: `font-medium ${getMddColor(strategy.mdd)}`, children: [strategy.mdd.toFixed(2), "%"] })] }), _jsxs("div", { children: [_jsx(Tooltip, { content: findGlossary('totalTrades')?.description ?? 'Total Trades', children: _jsx("span", { className: "text-text-muted", children: "Total Trades" }) }), _jsx("p", { className: "text-text font-medium", children: strategy.total_trades })] }), _jsxs("div", { children: [_jsx(Tooltip, { content: findGlossary('profitFactor')?.description ?? 'Profit Factor', children: _jsx("span", { className: "text-text-muted", children: "Profit Factor" }) }), _jsx("p", { className: "text-text font-medium", children: strategy.profit_factor.toFixed(2) })] })] }), _jsxs("div", { className: "border-t border-surface-border pt-3", children: [_jsx("h4", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider mb-2", children: "Parameters" }), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs", children: [_jsxs("div", { children: [_jsx(Tooltip, { content: findGlossary('entryType')?.description ?? 'Entry Type', children: _jsx("span", { className: "text-text-muted", children: "Entry Type" }) }), _jsx("p", { className: "text-text font-mono", children: strategy.entry_type || '-' })] }), _jsxs("div", { children: [_jsx(Tooltip, { content: findGlossary('stopLoss')?.description ?? 'Stop Loss', children: _jsx("span", { className: "text-text-muted", children: "Stop Loss" }) }), _jsx("p", { className: "text-text", children: strategy.stop_loss ? `${(strategy.stop_loss * 100).toFixed(1)}%` : '-' })] }), _jsxs("div", { children: [_jsx(Tooltip, { content: findGlossary('takeProfit')?.description ?? 'Take Profit', children: _jsx("span", { className: "text-text-muted", children: "Take Profit" }) }), _jsx("p", { className: "text-text", children: strategy.take_profit ? `${(strategy.take_profit * 100).toFixed(1)}%` : '-' })] }), _jsxs("div", { children: [_jsx(Tooltip, { content: findGlossary('trailingStop')?.description ?? 'Trailing Stop', children: _jsx("span", { className: "text-text-muted", children: "Trailing Stop" }) }), _jsx("p", { className: "text-text", children: strategy.trailing_stop ? `${(strategy.trailing_stop * 100).toFixed(1)}%` : '-' })] }), _jsxs("div", { children: [_jsx(Tooltip, { content: findGlossary('maxPositions')?.description ?? 'Max Concurrent', children: _jsx("span", { className: "text-text-muted", children: "Max Concurrent" }) }), _jsx("p", { className: "text-text", children: strategy.max_concurrent_positions || '-' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Ranking Limit" }), _jsx("p", { className: "text-text", children: strategy.ranking_candidate_limit || '-' })] })] })] }), _jsxs("div", { className: "border-t border-surface-border pt-3", children: [_jsx("h4", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider mb-2", children: "Evaluation Universe" }), strategy.universe_stocks?.length > 0 ? (_jsx("div", { className: "grid grid-cols-2 gap-1 max-h-32 overflow-y-auto", children: strategy.universe_stocks.map((u, i) => (_jsxs("div", { className: "flex items-center gap-1.5 text-xs py-0.5", children: [_jsx("span", { className: "text-text font-medium truncate", children: u.name }), _jsx("span", { className: "text-text-muted shrink-0", children: u.ticker })] }, i))) })) : (_jsx("p", { className: "text-xs text-text-muted", children: "No universe data" }))] }), _jsx("button", { onClick: onAddToPortfolio, className: "w-full text-xs px-3 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors", children: "Add to Portfolio" })] }));
}
function RiskSection({ data, loading, onRefresh }) {
    if (loading)
        return _jsx(SectionLoading, {});
    if (!data)
        return _jsx(SectionError, { message: "No risk data", onRetry: onRefresh });
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: `flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${data.risk_status === 'PASS' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`, children: [data.risk_status === 'PASS' ? _jsx(CheckCircle, { size: 14 }) : _jsx(AlertTriangle, { size: 14 }), "Status: ", data.risk_status, " ", data.blocked ? '(BLOCKED)' : ''] }), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs", children: [_jsxs("div", { className: "bg-surface rounded-xl p-3", children: [_jsx(Tooltip, { content: findGlossary('mdd')?.description ?? 'Portfolio MDD', children: _jsx("div", { className: "text-text-muted text-[10px]", children: "Portfolio MDD" }) }), _jsxs("div", { className: "font-medium text-text", children: [data.portfolio_mdd.toFixed(1), "%"] })] }), _jsxs("div", { className: "bg-surface rounded-xl p-3", children: [_jsx("div", { className: "text-text-muted text-[10px]", children: "Avg Unrealized P&L" }), _jsxs("div", { className: `font-medium ${data.avg_unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [data.avg_unrealized_pnl >= 0 ? '+' : '', data.avg_unrealized_pnl.toFixed(2), "%"] })] }), _jsxs("div", { className: "bg-surface rounded-xl p-3", children: [_jsx("div", { className: "text-text-muted text-[10px]", children: "Daily P&L" }), _jsxs("div", { className: `font-medium ${data.today_pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [data.today_pnl_pct >= 0 ? '+' : '', data.today_pnl_pct.toFixed(2), "%"] })] }), _jsxs("div", { className: "bg-surface rounded-xl p-3", children: [_jsx(Tooltip, { content: findGlossary('maxPositions')?.description ?? 'Open Positions', children: _jsx("div", { className: "text-text-muted text-[10px]", children: "Open Positions" }) }), _jsx("div", { className: "font-medium text-text", children: data.open_positions })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs", children: [data.cash_ratio > 0 && (_jsxs("div", { className: "bg-surface rounded-xl p-3", children: [_jsx(Tooltip, { content: findGlossary('cashRatio')?.description ?? 'Cash Ratio', children: _jsx("div", { className: "text-text-muted text-[10px]", children: "Cash Ratio" }) }), _jsxs("div", { className: "font-medium text-blue-400", children: [data.cash_ratio.toFixed(1), "%"] })] })), data.single_asset_ratio > 0 && (_jsxs("div", { className: "bg-surface rounded-xl p-3", children: [_jsx("div", { className: "text-text-muted text-[10px]", children: "Single Asset Ratio" }), _jsxs("div", { className: "font-medium text-text", children: [data.single_asset_ratio.toFixed(1), "%"] })] }))] }), data.blocked && data.reasons.length > 0 && (_jsxs("div", { children: [_jsx("h4", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider mb-2", children: "BLOCKED Reasons" }), _jsx("div", { className: "space-y-1", children: data.reasons.map((r, i) => (_jsxs("div", { className: "flex items-center gap-1.5 text-xs text-red-400 bg-red-500/5 rounded-lg px-2.5 py-1.5", children: [_jsx(AlertTriangle, { size: 10 }), r] }, i))) })] }))] }));
}
function PromotionSection({ data, loading, onRefresh }) {
    const { loading: actionLoading, execute } = useAction();
    if (loading)
        return _jsx(SectionLoading, {});
    async function autoPromote() {
        await execute(() => api.post('/api/portfolio/auto-promote'), 'Auto promote completed');
        onRefresh();
    }
    if (!data || data.length === 0) {
        return (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "text-xs text-text-muted text-center py-4", children: "No promotion history" }), _jsx("button", { onClick: autoPromote, disabled: actionLoading, className: "w-full text-xs px-3 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50", children: actionLoading ? 'Running...' : 'Auto Promote Candidates' })] }));
    }
    return (_jsxs("div", { className: "space-y-2", children: [data.map(p => (_jsxs("div", { className: "flex items-center justify-between bg-surface rounded-xl px-3 py-2.5 text-xs", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `px-1.5 py-0.5 rounded text-[10px] font-medium ${p.action === 'promoted' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`, children: p.action }), _jsxs("div", { children: [_jsx("div", { className: "text-text font-medium", children: p.strategy_name || `#${p.strategy_id}` }), p.reason && _jsx("div", { className: "text-text-muted text-[10px]", children: p.reason })] })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: "text-amber-400", children: ["fitness: ", p.fitness.toFixed(2)] }), _jsx("div", { className: "text-text-muted text-[10px]", children: formatKST(p.promoted_at) })] })] }, p.id))), _jsx("button", { onClick: autoPromote, disabled: actionLoading, className: "w-full text-xs px-3 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50", children: actionLoading ? 'Running...' : 'Auto Promote Candidates' })] }));
}
function ValidationSection({ data: data_, loading, onRefresh }) {
    const { loading: actionLoading, execute } = useAction();
    if (loading)
        return _jsx(SectionLoading, {});
    if (!data_)
        return (_jsx(SectionError, { message: "Validation mode inactive \u2014 Start validation to evaluate strategy performance over 30-day paper trading", onRetry: onRefresh }));
    const data = data_;
    async function toggleValidation() {
        const endpoint = data.is_active ? '/api/validation/stop' : '/api/validation/start';
        await execute(() => api.post(endpoint), data.is_active ? 'Validation stopped' : 'Validation started');
        onRefresh();
    }
    const daysElapsed = data.started_at
        ? Math.floor((Date.now() - new Date(data.started_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: `flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${data.is_active ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'}`, children: [_jsx(Activity, { size: 14 }), data.is_active
                        ? `Active — Day ${Math.min(daysElapsed + 1, 30)}/30`
                        : 'Inactive — Start 30-day validation to collect readiness data', data.started_at && _jsxs("span", { className: "text-text-muted", children: ["since ", formatKST(data.started_at)] })] }), data.is_active && data.today && (_jsxs("div", { className: "grid grid-cols-3 gap-2 text-xs", children: [_jsxs("div", { className: "bg-surface rounded-xl p-3 text-center", children: [_jsx(Tooltip, { content: findGlossary('return')?.description ?? 'Total Return', children: _jsx("div", { className: "text-text-muted text-[10px]", children: "Total Return" }) }), _jsxs("div", { className: `font-bold ${data.today.cumulative_return >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [data.today.cumulative_return >= 0 ? '+' : '', data.today.cumulative_return.toFixed(2), "%"] })] }), _jsxs("div", { className: "bg-surface rounded-xl p-3 text-center", children: [_jsx(Tooltip, { content: findGlossary('mdd')?.description ?? 'MDD', children: _jsx("div", { className: "text-text-muted text-[10px]", children: "MDD" }) }), _jsxs("div", { className: "font-bold text-red-400", children: [data.today.mdd.toFixed(1), "%"] })] }), _jsxs("div", { className: "bg-surface rounded-xl p-3 text-center", children: [_jsx(Tooltip, { content: findGlossary('winRate')?.description ?? 'Win Rate', children: _jsx("div", { className: "text-text-muted text-[10px]", children: "Win Rate" }) }), _jsxs("div", { className: "font-bold text-blue-400", children: [data.today.win_rate.toFixed(1), "%"] })] })] })), _jsx("button", { onClick: toggleValidation, disabled: actionLoading, className: "w-full text-xs px-3 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50", children: actionLoading ? 'Processing...' : data.is_active ? 'Stop Validation' : 'Start 30-Day Validation' })] }));
}
function ReadinessSection({ data, loading }) {
    if (loading)
        return _jsx(SectionLoading, {});
    if (!data)
        return _jsx(SectionError, { message: "Readiness check unavailable" });
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: `flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${data.ready ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`, children: [data.ready ? _jsx(CheckCircle, { size: 14 }) : _jsx(Clock, { size: 14 }), data.ready ? 'Ready for Live Trading' : 'Not Ready'] }), _jsx("div", { className: "space-y-1.5", children: data.checks?.map((check, i) => (_jsxs("div", { className: "bg-surface rounded-lg px-3 py-2 text-xs", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [check.passed
                                            ? _jsx(CheckCircle, { size: 12, className: "text-green-400" })
                                            : _jsx(XCircle, { size: 12, className: "text-red-400" }), _jsx("span", { className: "text-text font-medium", children: check.name })] }), _jsx("span", { className: `text-[11px] font-mono ${check.passed ? 'text-green-400' : 'text-red-400'}`, children: check.passed ? 'PASS' : 'FAIL' })] }), _jsxs("div", { className: "flex items-center justify-between text-[10px] text-text-muted", children: [_jsxs("span", { children: ["Current: ", check.actual.toFixed(2)] }), _jsxs("span", { children: ["Target: ", check.threshold] }), !check.passed && (_jsxs("span", { className: "text-amber-400", children: ["Gap: ", (check.threshold - check.actual).toFixed(2)] }))] }), _jsx("div", { className: "text-[9px] text-text-muted mt-0.5", children: check.detail })] }, i))) })] }));
}
