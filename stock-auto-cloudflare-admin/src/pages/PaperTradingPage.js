import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Wallet, TrendingUp, TrendingDown, RefreshCw, Play, Activity, } from 'lucide-react';
export default function PaperTradingPage() {
    const [status, setStatus] = useState(null);
    const [signals, setSignals] = useState([]);
    const [positions, setPositions] = useState([]);
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [executing, setExecuting] = useState(false);
    const [execResult, setExecResult] = useState(null);
    const activeTab = window.location.hash?.includes('trades') ? 'trades' : 'positions';
    useEffect(() => { loadAll(); }, []);
    async function loadAll() {
        try {
            const [s, p, t] = await Promise.all([
                api.get('/api/paper-trading/status').catch(() => null),
                api.get('/api/paper-trading/positions').catch(() => null),
                api.get('/api/paper-trading/trades').catch(() => null),
            ]);
            if (s)
                setStatus(s);
            if (p)
                setPositions(p.items || []);
            if (t)
                setTrades(t.items || []);
        }
        catch { }
        finally {
            setLoading(false);
        }
    }
    async function generateAndExecute() {
        setExecuting(true);
        setExecResult(null);
        try {
            const sig = await api.post('/api/paper-trading/signals');
            setSignals(sig.signals || []);
            if ((sig.signals || []).length > 0) {
                const r = await api.post('/api/paper-trading/execute', { signals: sig.signals });
                setExecResult(`Executed ${r.count} trades`);
            }
            else {
                setExecResult('No signals generated');
            }
            loadAll();
        }
        catch (e) {
            setExecResult(`Error: ${e.message || 'Unknown'}`);
        }
        setExecuting(false);
    }
    if (loading) {
        return _jsx("div", { className: "flex items-center justify-center h-48 text-xs text-text-muted", children: "Loading paper trading..." });
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-bold text-text", children: "Paper Trading" }), _jsx("span", { className: "text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400", children: "Mock Broker" })] }), status && (_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [_jsxs("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-text-muted mb-1", children: [_jsx(Wallet, { size: 14 }), _jsx("span", { className: "text-[10px] font-medium", children: "Total Value" })] }), _jsxs("div", { className: "text-lg font-bold text-text", children: ["\u20A9", status.total_value.toLocaleString()] })] }), _jsxs("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-text-muted mb-1", children: [_jsx(TrendingUp, { size: 14 }), _jsx("span", { className: "text-[10px] font-medium", children: "Cash" })] }), _jsxs("div", { className: "text-lg font-bold text-blue-400", children: ["\u20A9", status.cash.toLocaleString()] })] }), _jsxs("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-text-muted mb-1", children: [_jsx(Activity, { size: 14 }), _jsx("span", { className: "text-[10px] font-medium", children: "Positions" })] }), _jsx("div", { className: "text-lg font-bold text-amber-400", children: status.positions_count })] }), _jsxs("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-text-muted mb-1", children: [_jsx(TrendingDown, { size: 14 }), _jsx("span", { className: "text-[10px] font-medium", children: "Total P&L" })] }), _jsxs("div", { className: `text-lg font-bold ${status.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [status.total_pnl >= 0 ? '+' : '', "\u20A9", Math.abs(status.total_pnl).toLocaleString()] })] })] })), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: generateAndExecute, disabled: executing, className: "flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50", children: [_jsx(Play, { size: 12 }), " ", executing ? 'Running...' : 'Generate Signals & Execute'] }), _jsx("button", { onClick: loadAll, className: "p-2 text-text-muted hover:text-text transition-colors", children: _jsx(RefreshCw, { size: 14 }) })] }), execResult && (_jsx("div", { className: "text-xs px-3 py-2 rounded-lg bg-primary/10 text-primary", children: execResult })), signals.length > 0 && (_jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsx("div", { className: "p-3 border-b border-surface-border", children: _jsxs("h3", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: ["Signals Generated (", signals.length, ")"] }) }), _jsx("div", { className: "divide-y divide-surface-border max-h-40 overflow-y-auto", children: signals.map((sig, i) => (_jsxs("div", { className: "px-4 py-2 text-[11px] flex items-center gap-2", children: [_jsx("span", { className: `px-1.5 py-0.5 rounded-full text-[10px] font-medium ${sig.signal === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`, children: sig.signal }), _jsx("span", { className: "text-text font-medium", children: sig.name }), _jsx("span", { className: "text-text-muted", children: sig.ticker }), _jsxs("span", { className: "text-text-muted ml-auto", children: ["\u20A9", sig.price.toLocaleString()] })] }, i))) })] })), _jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsxs("div", { className: "p-3 border-b border-surface-border flex items-center gap-4", children: [_jsx("h3", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Open Positions" }), _jsxs("span", { className: "text-[10px] text-text-muted", children: [positions.filter(p => p.status === 'open').length, " open"] })] }), positions.filter(p => p.status === 'open').length === 0 ? (_jsx("div", { className: "p-6 text-center text-xs text-text-muted", children: "No open positions" })) : (_jsx("div", { className: "divide-y divide-surface-border", children: positions.filter(p => p.status === 'open').map(p => (_jsxs("div", { className: "px-4 py-3 flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-sm font-medium text-text", children: p.ticker }), _jsxs("span", { className: "text-[10px] text-text-muted", children: ["S", p.strategy_id] })] }), _jsxs("div", { className: "text-[10px] text-text-muted mt-0.5", children: ["Entry: \u20A9", p.entry_price.toLocaleString(), " \u00B7 Qty: ", p.quantity] })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: `text-sm font-bold ${p.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [p.pnl_pct >= 0 ? '+' : '', p.pnl_pct.toFixed(2), "%"] }), _jsxs("div", { className: "text-[10px] text-text-muted", children: [p.pnl_amt >= 0 ? '+' : '', "\u20A9", Math.abs(p.pnl_amt).toLocaleString()] })] })] }, p.id))) }))] }), _jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsx("div", { className: "p-3 border-b border-surface-border", children: _jsx("h3", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Recent Trades" }) }), trades.length === 0 ? (_jsx("div", { className: "p-6 text-center text-xs text-text-muted", children: "No trades yet" })) : (_jsx("div", { className: "divide-y divide-surface-border max-h-60 overflow-y-auto", children: trades.slice(0, 30).map(t => (_jsxs("div", { className: "px-4 py-2 text-[11px] flex items-center gap-2", children: [_jsx("span", { className: `px-1.5 py-0.5 rounded-full text-[10px] font-medium ${t.action === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`, children: t.action }), _jsx("span", { className: "text-text font-medium", children: t.ticker }), _jsxs("span", { className: "text-text-muted", children: ["\u20A9", t.price.toLocaleString(), " x ", t.quantity] }), t.pnl_pct !== 0 && (_jsxs("span", { className: t.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400', children: [t.pnl_pct >= 0 ? '+' : '', t.pnl_pct.toFixed(2), "%"] })), _jsx("span", { className: "text-text-muted ml-auto", children: t.reason || '-' })] }, t.id))) }))] })] }));
}
