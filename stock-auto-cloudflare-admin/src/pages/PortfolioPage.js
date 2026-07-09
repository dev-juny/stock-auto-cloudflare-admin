import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Trash2, CheckCircle, XCircle, RefreshCw, Calendar, } from 'lucide-react';
const STATUS_STYLES = {
    candidate: 'bg-amber-500/10 text-amber-400',
    approved: 'bg-green-500/10 text-green-400',
    disabled: 'bg-surface-border text-text-muted',
};
export default function PortfolioPage() {
    const [strategies, setStrategies] = useState(null);
    const [showBacktest, setShowBacktest] = useState(false);
    const [btResult, setBtResult] = useState(null);
    const [btHistory, setBtHistory] = useState([]);
    const [btRunning, setBtRunning] = useState(false);
    const [btPeriod, setBtPeriod] = useState('1y');
    const [btUniverse, setBtUniverse] = useState('KOSPI');
    const [btCapital, setBtCapital] = useState(10000000);
    useEffect(() => { load(); loadHistory(); }, []);
    async function load() {
        try {
            const d = await api.get('/api/portfolio/strategies');
            if (d && Array.isArray(d)) {
                setStrategies({ items: d, total_allocation: 0 });
            }
            else if (d?.items) {
                setStrategies(d);
            }
            else {
                setStrategies({ items: [], total_allocation: 0 });
            }
        }
        catch { }
    }
    async function loadHistory() {
        try {
            const d = await api.get('/api/portfolio/backtest/results');
            setBtHistory(d.items || []);
        }
        catch { }
    }
    async function updateStrategy(id, data) {
        try {
            await api.patch(`/api/portfolio/strategies/${id}`, data);
            load();
        }
        catch { }
    }
    async function removeStrategy(id) {
        try {
            await api.delete(`/api/portfolio/strategies/${id}`);
            load();
        }
        catch { }
    }
    async function runBacktest() {
        setBtRunning(true);
        setBtResult(null);
        try {
            const r = await api.post('/api/portfolio/backtest', {
                period: btPeriod,
                universe: btUniverse,
                initial_capital: btCapital,
                strategy_limit: 5,
            });
            setBtResult(r);
            loadHistory();
        }
        catch { }
        setBtRunning(false);
    }
    const totalAlloc = strategies?.total_allocation || 0;
    const maxVal = btResult?.daily_values?.length ? Math.max(...btResult.daily_values.map(d => d.value), btResult.initial_capital) : 0;
    const minVal = btResult?.daily_values?.length ? Math.min(...btResult.daily_values.map(d => d.value), btResult.initial_capital) : 0;
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-bold text-text", children: "Strategy Portfolio" }), _jsx("button", { onClick: load, className: "p-2 text-text-muted hover:text-text transition-colors", children: _jsx(RefreshCw, { size: 14 }) })] }), strategies?.items?.length === 0 ? (_jsx("div", { className: "bg-surface-card rounded-2xl border border-surface-border p-6 text-center text-xs text-text-muted", children: "No strategies in portfolio. Go to Strategy tab to add strategies." })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsxs("div", { className: "p-3 border-b border-surface-border flex items-center justify-between", children: [_jsx("h3", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Portfolio Strategies" }), _jsxs("span", { className: `text-[10px] font-medium px-1.5 py-0.5 rounded-full ${Math.abs(totalAlloc - 100) < 0.01 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`, children: [totalAlloc.toFixed(1), "%"] })] }), _jsx("div", { className: "divide-y divide-surface-border", children: strategies?.items?.map(s => (_jsxs("div", { className: "px-4 py-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "text-sm font-medium text-text", children: ["Gen ", s.generation, "-", s.strategy_id] }), _jsx("span", { className: `text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_STYLES[s.status] || ''}`, children: s.status })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "text-sm font-bold text-primary", children: [s.allocation.toFixed(1), "%"] }), _jsx("button", { onClick: () => removeStrategy(s.id), className: "p-1 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors", children: _jsx(Trash2, { size: 12 }) })] })] }), _jsxs("div", { className: "flex gap-3 mt-1 text-[10px] text-text-muted", children: [_jsxs("span", { children: ["Fitness: ", _jsx("span", { className: "text-amber-400", children: s.fitness.toFixed(2) })] }), _jsxs("span", { children: ["Return: ", _jsxs("span", { className: s.return_pct >= 0 ? 'text-green-400' : 'text-red-400', children: [s.return_pct.toFixed(1), "%"] })] }), _jsxs("span", { children: ["Win: ", _jsxs("span", { className: "text-blue-400", children: [s.win_rate.toFixed(1), "%"] })] })] }), s.status === 'candidate' && (_jsxs("div", { className: "flex gap-2 mt-2", children: [_jsxs("button", { onClick: () => updateStrategy(s.id, { status: 'approved' }), className: "text-[10px] px-2 py-1 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors", children: [_jsx(CheckCircle, { size: 10, className: "inline mr-1" }), "Approve"] }), _jsxs("button", { onClick: () => updateStrategy(s.id, { status: 'disabled' }), className: "text-[10px] px-2 py-1 rounded-lg bg-surface-border text-text-muted hover:text-text transition-colors", children: [_jsx(XCircle, { size: 10, className: "inline mr-1" }), "Disable"] })] })), s.status === 'approved' && (_jsxs("div", { className: "flex gap-2 mt-2", children: [_jsx("input", { type: "range", min: "0", max: "100", value: s.allocation, onChange: e => updateStrategy(s.id, { allocation: parseFloat(e.target.value) }), className: "flex-1 h-1 accent-primary" }), _jsxs("span", { className: "text-[10px] text-text-muted w-8 text-right", children: [s.allocation.toFixed(0), "%"] })] }))] }, s.id))) })] }), _jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsx("div", { className: "p-3 border-b border-surface-border", children: _jsx("h3", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Portfolio Backtest" }) }), _jsxs("div", { className: "p-4 space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-2", children: [_jsxs("div", { children: [_jsx("label", { className: "text-[10px] text-text-muted block mb-1", children: "Period" }), _jsxs("select", { value: btPeriod, onChange: e => setBtPeriod(e.target.value), className: "w-full bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border", children: [_jsx("option", { value: "1y", children: "1 Year" }), _jsx("option", { value: "2y", children: "2 Years" }), _jsx("option", { value: "3y", children: "3 Years" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-[10px] text-text-muted block mb-1", children: "Universe" }), _jsxs("select", { value: btUniverse, onChange: e => setBtUniverse(e.target.value), className: "w-full bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border", children: [_jsx("option", { value: "KOSPI", children: "KOSPI" }), _jsx("option", { value: "KOSDAQ", children: "KOSDAQ" }), _jsx("option", { value: "ALL", children: "KOSPI + KOSDAQ" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-[10px] text-text-muted block mb-1", children: "Initial Capital" }), _jsx("input", { type: "number", value: btCapital, onChange: e => setBtCapital(Number(e.target.value)), className: "w-full bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border" })] }), _jsx("div", { className: "flex items-end", children: _jsx("button", { onClick: runBacktest, disabled: btRunning, className: "w-full text-xs px-3 py-1.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50", children: btRunning ? 'Running...' : 'Run Backtest' }) })] }), btResult && (_jsxs("div", { className: "border-t border-surface-border pt-3 space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs", children: [_jsxs("div", { className: "bg-surface rounded-xl p-2", children: [_jsx("span", { className: "text-text-muted", children: "Return" }), _jsxs("p", { className: `text-sm font-bold ${btResult.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [btResult.return_pct >= 0 ? '+' : '', btResult.return_pct.toFixed(2), "%"] })] }), _jsxs("div", { className: "bg-surface rounded-xl p-2", children: [_jsx("span", { className: "text-text-muted", children: "Win Rate" }), _jsxs("p", { className: "text-sm font-bold text-blue-400", children: [btResult.win_rate.toFixed(1), "%"] })] }), _jsxs("div", { className: "bg-surface rounded-xl p-2", children: [_jsx("span", { className: "text-text-muted", children: "MDD" }), _jsxs("p", { className: "text-sm font-bold text-red-400", children: [btResult.mdd.toFixed(2), "%"] })] }), _jsxs("div", { className: "bg-surface rounded-xl p-2", children: [_jsx("span", { className: "text-text-muted", children: "Sharpe" }), _jsx("p", { className: "text-sm font-bold text-amber-400", children: btResult.sharpe_ratio.toFixed(2) })] }), _jsxs("div", { className: "bg-surface rounded-xl p-2", children: [_jsx("span", { className: "text-text-muted", children: "CAGR" }), _jsxs("p", { className: `text-sm font-bold ${btResult.cagr >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [btResult.cagr >= 0 ? '+' : '', btResult.cagr.toFixed(2), "%"] })] }), _jsxs("div", { className: "bg-surface rounded-xl p-2", children: [_jsx("span", { className: "text-text-muted", children: "Trades" }), _jsx("p", { className: "text-sm font-bold text-text", children: btResult.trade_count })] })] }), btResult?.daily_values?.length > 1 && (_jsxs("div", { className: "bg-surface rounded-xl p-3", children: [_jsx("h4", { className: "text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2", children: "Equity Curve" }), _jsx("div", { className: "flex items-end gap-0.5 h-24", children: btResult.daily_values.filter((_, i) => i % Math.max(1, Math.floor(btResult.daily_values.length / 60)) === 0).map((d, i) => {
                                                            const h = ((d.value - minVal) / (maxVal - minVal || 1)) * 100;
                                                            return (_jsx("div", { className: "flex-1 rounded-t-sm bg-primary/60 hover:bg-primary/80 transition-colors", style: { height: `${Math.max(h, 2)}%` }, title: `${d.date}: ₩${d.value.toLocaleString()}` }, i));
                                                        }) })] })), _jsxs("div", { className: "text-[10px] text-text-muted", children: ["Strategies tested: ", btResult.strategies_tested, " \u00B7 Tickers screened: ", btResult.tickers_screened, " \u00B7 Capital: \u20A9", btResult.initial_capital.toLocaleString(), " \u2192 \u20A9", btResult.final_value.toLocaleString()] })] }))] })] }), btHistory.length > 0 && (_jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsx("div", { className: "p-3 border-b border-surface-border", children: _jsx("h3", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Backtest History" }) }), _jsx("div", { className: "divide-y divide-surface-border", children: btHistory.slice(0, 5).map(h => (_jsxs("div", { className: "px-4 py-2 text-[11px] flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Calendar, { size: 10, className: "text-text-muted" }), _jsxs("span", { className: "text-text-muted", children: [h.period_start, " ~ ", h.period_end] })] }), _jsxs("div", { className: "flex gap-3", children: [_jsxs("span", { className: h.return_pct >= 0 ? 'text-green-400' : 'text-red-400', children: [h.return_pct >= 0 ? '+' : '', h.return_pct.toFixed(1), "%"] }), _jsxs("span", { className: "text-text-muted", children: ["MDD ", h.mdd.toFixed(1), "%"] }), _jsxs("span", { className: "text-amber-400", children: ["Sharpe ", h.sharpe_ratio.toFixed(2)] })] })] }, h.id))) })] }))] }))] }));
}
