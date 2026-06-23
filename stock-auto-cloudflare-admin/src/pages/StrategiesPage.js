import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../utils/api';
import { ArrowUpDown, RefreshCw, ChevronLeft, ChevronRight, Target, } from 'lucide-react';
const SORT_OPTIONS = [
    { label: 'Fitness', value: 'fitness' },
    { label: 'Return', value: 'return' },
    { label: 'Win Rate', value: 'win_rate' },
    { label: 'MDD', value: 'mdd' },
    { label: 'Generation', value: 'generation' },
];
export default function StrategiesPage() {
    const [data, setData] = useState(null);
    const [offset, setOffset] = useState(0);
    const [limit] = useState(20);
    const [sortBy, setSortBy] = useState('fitness');
    const [sortDir, setSortDir] = useState('desc');
    const [selectedStrategy, setSelectedStrategy] = useState(null);
    const [addingToPortfolio, setAddingToPortfolio] = useState(false);
    const [portfolioStatus, setPortfolioStatus] = useState(null);
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
        }
        catch { }
    }
    async function addToPortfolio(s) {
        setAddingToPortfolio(true);
        setPortfolioStatus(null);
        try {
            await api.post('/api/portfolio/strategies', {
                strategy_id: s.strategy_id,
                generation: s.generation,
                allocation: 0,
                status: 'candidate',
            });
            setPortfolioStatus('added');
        }
        catch {
            setPortfolioStatus('error');
        }
        finally {
            setAddingToPortfolio(false);
        }
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-bold text-text", children: "Top Strategies" }), _jsx("button", { onClick: load, className: "p-2 text-text-muted hover:text-text transition-colors", children: _jsx(RefreshCw, { size: 14 }) })] }), _jsxs("div", { className: "flex items-center gap-2 text-[10px] text-text-muted bg-surface-card rounded-xl px-3 py-2 border border-surface-border", children: [_jsx(Target, { size: 12 }), _jsx("span", { children: "Filters: Fitness \u2265 50 \u00B7 Win Rate \u2265 45% \u00B7 Trades \u2265 30 \u00B7 MDD \u2264 20% \u00B7 Return \u2265 20%" })] }), _jsx("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: !data?.items ? (_jsx("div", { className: "p-6 text-center text-xs text-text-muted", children: "Loading..." })) : data.items.length === 0 ? (_jsx("div", { className: "p-6 text-center text-xs text-text-muted", children: "No strategies meet the criteria" })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-text-muted border-b border-surface-border", children: [_jsx("th", { className: "text-left px-3 py-2 font-medium", children: "Gen" }), SORT_OPTIONS.map(o => (_jsx("th", { className: "text-right px-2 py-2 font-medium", children: _jsxs("button", { onClick: () => { setSortBy(o.value); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }, className: `flex items-center gap-1 ml-auto hover:text-text transition-colors ${sortBy === o.value ? 'text-primary' : ''}`, children: [o.label, " ", _jsx(ArrowUpDown, { size: 10 })] }) }, o.value))), _jsx("th", { className: "text-right px-2 py-2 font-medium", children: "Trades" }), _jsx("th", { className: "text-right px-2 py-2 font-medium", children: "Action" })] }) }), _jsx("tbody", { className: "divide-y divide-surface-border", children: data.items.map(s => (_jsxs("tr", { className: "hover:bg-surface/50 transition-colors cursor-pointer", onClick: () => loadDetail(s.strategy_id), children: [_jsx("td", { className: "px-3 py-2 text-text font-medium", children: s.generation }), _jsx("td", { className: "px-2 py-2 text-right text-amber-400", children: s.fitness.toFixed(2) }), _jsxs("td", { className: `px-2 py-2 text-right ${s.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [s.return_pct >= 0 ? '+' : '', s.return_pct.toFixed(2), "%"] }), _jsxs("td", { className: "px-2 py-2 text-right text-blue-400", children: [s.win_rate.toFixed(1), "%"] }), _jsxs("td", { className: "px-2 py-2 text-right text-red-400", children: [s.mdd.toFixed(2), "%"] }), _jsx("td", { className: "px-2 py-2 text-right text-text-muted", children: s.generation }), _jsx("td", { className: "px-2 py-2 text-right text-text-muted", children: s.total_trades }), _jsx("td", { className: "px-2 py-2 text-right", children: _jsx("button", { onClick: (e) => { e.stopPropagation(); addToPortfolio(s); }, disabled: addingToPortfolio, className: "text-[10px] px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50", children: portfolioStatus === 'added' ? 'Added' : '+ Portfolio' }) })] }, s.strategy_id))) })] }) }), _jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-t border-surface-border", children: [_jsxs("span", { className: "text-[11px] text-text-muted", children: [data.total, " total \u00B7 Page ", currentPage, " of ", totalPages || 1] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { disabled: offset === 0, onClick: () => setOffset(o => Math.max(0, o - limit)), className: "p-1.5 rounded-lg disabled:opacity-30 text-text-muted hover:text-text transition-colors", children: _jsx(ChevronLeft, { size: 14 }) }), _jsx("button", { disabled: offset + limit >= data.total, onClick: () => setOffset(o => o + limit), className: "p-1.5 rounded-lg disabled:opacity-30 text-text-muted hover:text-text transition-colors", children: _jsx(ChevronRight, { size: 14 }) })] })] })] })) }), selectedStrategy && (_jsx("div", { className: "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40", onClick: () => setSelectedStrategy(null), children: _jsxs("div", { className: "bg-surface-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[80vh] overflow-y-auto", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "sticky top-0 bg-surface-card border-b border-surface-border p-3 flex items-center justify-between", children: [_jsxs("h3", { className: "text-sm font-semibold text-text", children: ["Strategy #", selectedStrategy.strategy_id] }), _jsx("button", { onClick: () => setSelectedStrategy(null), className: "text-text-muted hover:text-text text-lg leading-none", children: "\u00D7" })] }), _jsxs("div", { className: "p-4 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs", children: [_jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Generation" }), _jsx("p", { className: "text-text font-medium", children: selectedStrategy.generation })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Version" }), _jsx("p", { className: "text-text font-medium", children: selectedStrategy.version })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Fitness" }), _jsx("p", { className: "text-amber-400 font-bold", children: selectedStrategy.fitness.toFixed(2) })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Return" }), _jsxs("p", { className: `font-bold ${selectedStrategy.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [selectedStrategy.return_pct >= 0 ? '+' : '', selectedStrategy.return_pct.toFixed(2), "%"] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Win Rate" }), _jsxs("p", { className: "text-blue-400 font-medium", children: [selectedStrategy.win_rate.toFixed(1), "%"] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "MDD" }), _jsxs("p", { className: "text-red-400 font-medium", children: [selectedStrategy.mdd.toFixed(2), "%"] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Total Trades" }), _jsx("p", { className: "text-text font-medium", children: selectedStrategy.total_trades })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Profit Factor" }), _jsx("p", { className: "text-text font-medium", children: selectedStrategy.profit_factor.toFixed(2) })] })] }), _jsxs("div", { className: "border-t border-surface-border pt-3", children: [_jsx("h4", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider mb-2", children: "Strategy Parameters" }), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs", children: [_jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Entry Type" }), _jsx("p", { className: "text-text font-mono", children: selectedStrategy.entry_type || '-' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Stop Loss" }), _jsx("p", { className: "text-text", children: selectedStrategy.stop_loss ? `${(selectedStrategy.stop_loss * 100).toFixed(1)}%` : '-' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Take Profit" }), _jsx("p", { className: "text-text", children: selectedStrategy.take_profit ? `${(selectedStrategy.take_profit * 100).toFixed(1)}%` : '-' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Trailing Stop" }), _jsx("p", { className: "text-text", children: selectedStrategy.trailing_stop ? `${(selectedStrategy.trailing_stop * 100).toFixed(1)}%` : '-' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Max Concurrent" }), _jsx("p", { className: "text-text", children: selectedStrategy.max_concurrent_positions || '-' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Ranking Limit" }), _jsx("p", { className: "text-text", children: selectedStrategy.ranking_candidate_limit || '-' })] })] })] }), _jsxs("div", { className: "border-t border-surface-border pt-3", children: [_jsx("h4", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider mb-2", children: "Evaluation Universe" }), selectedStrategy.universe_stocks?.length > 0 ? (_jsx("div", { className: "grid grid-cols-2 gap-1 max-h-32 overflow-y-auto", children: selectedStrategy.universe_stocks.map((u, i) => (_jsxs("div", { className: "flex items-center gap-1.5 text-xs py-0.5", children: [_jsx("span", { className: "text-text font-medium truncate", children: u.name }), _jsx("span", { className: "text-text-muted shrink-0", children: u.ticker })] }, i))) })) : (_jsx("p", { className: "text-xs text-text-muted", children: "No universe data" }))] }), _jsx("button", { onClick: () => { addToPortfolio(selectedStrategy); setSelectedStrategy(null); }, disabled: addingToPortfolio, className: "w-full text-xs px-3 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50", children: portfolioStatus === 'added' ? 'Added to Portfolio' : 'Add to Portfolio' })] })] }) }))] }));
}
