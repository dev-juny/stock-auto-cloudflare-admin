import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../utils/api';
import { useToast } from '../components/common/Toast';
import { useAction } from '../hooks/useAction';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Tooltip } from '../components/common/Tooltip';
import { findGlossary } from '../utils/glossary';
import { Wallet, TrendingUp, TrendingDown, RefreshCw, Play, XCircle, Activity, LogOut, Pause, PlayCircle, } from 'lucide-react';
export default function PaperTradingPage() {
    const [status, setStatus] = useState(null);
    const [signals, setSignals] = useState([]);
    const [positions, setPositions] = useState([]);
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [paused, setPaused] = useState(false);
    const [execResult, setExecResult] = useState(null);
    const [showTestExit, setShowTestExit] = useState(false);
    const [testExitPosId, setTestExitPosId] = useState(null);
    const [testExitCondition, setTestExitCondition] = useState('stop_loss');
    const [showSignals, setShowSignals] = useState(false);
    const [prevPnl, setPrevPnl] = useState(null);
    const [pnlChange, setPnlChange] = useState(null);
    const { toast } = useToast();
    const { loading: execLoading, execute } = useAction();
    const { loading: testExitLoading, execute: testExitExec } = useAction();
    const { loading: cycleLoading, execute: cycleExec } = useAction();
    const intervalRef = useRef(null);
    const prevPnlRef = useRef(null);
    const loadAll = useCallback(async () => {
        try {
            setError(null);
            const [s, p, t] = await Promise.all([
                api.get('/api/paper-trading/status').catch(() => null),
                api.get('/api/paper-trading/positions').catch(() => null),
                api.get('/api/paper-trading/trades').catch(() => null),
            ]);
            if (s) {
                if (prevPnlRef.current !== null && prevPnlRef.current !== s.total_pnl) {
                    setPnlChange(s.total_pnl - prevPnlRef.current);
                    setTimeout(() => setPnlChange(null), 3000);
                }
                prevPnlRef.current = s.total_pnl;
                setStatus(s);
            }
            if (p)
                setPositions(p.items || []);
            if (t)
                setTrades(t.items || []);
        }
        catch (e) {
            setError(e.message || 'Failed to load');
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { loadAll(); }, [loadAll]);
    useEffect(() => {
        if (!autoRefresh || paused) {
            if (intervalRef.current)
                clearInterval(intervalRef.current);
            return;
        }
        intervalRef.current = setInterval(loadAll, 15000);
        return () => { if (intervalRef.current)
            clearInterval(intervalRef.current); };
    }, [autoRefresh, paused, loadAll]);
    async function togglePause() {
        const action = paused ? 'resume' : 'pause';
        try {
            await api.post(`/api/scheduler/jobs/paper-trading/${action}`);
            setPaused(!paused);
            toast(paused ? 'info' : 'warning', `Paper trading ${action}d`);
        }
        catch {
            toast('error', `Failed to ${action} paper trading`);
        }
    }
    async function generateAndExecute() {
        setShowSignals(true);
        const sig = await execute(async () => {
            const s = await api.post('/api/paper-trading/signals');
            setSignals(s.signals || []);
            if ((s.signals || []).length > 0) {
                const r = await api.post('/api/paper-trading/execute', { signals: s.signals });
                return r;
            }
            return s;
        }, 'Signals generated & executed');
        if (sig)
            loadAll();
    }
    async function runTestExit() {
        if (!testExitPosId)
            return;
        await testExitExec(() => api.post('/api/paper-trading/test-exit', {
            pos_id: testExitPosId,
            condition: testExitCondition,
        }), 'Test exit completed');
        setShowTestExit(false);
        loadAll();
    }
    async function runFullCycle() {
        await cycleExec(() => api.post('/api/paper-trading/run-cycle'), 'Full cycle completed');
        loadAll();
    }
    if (loading) {
        return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "skeleton h-5 w-32" }), _jsx("div", { className: "skeleton h-5 w-20" })] }), _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [1, 2, 3, 4].map(i => (_jsxs("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: [_jsx("div", { className: "skeleton h-3 w-16 mb-2" }), _jsx("div", { className: "skeleton h-6 w-24" })] }, i))) })] }));
    }
    if (error) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center h-48 gap-3", children: [_jsx(XCircle, { size: 24, className: "text-red-400" }), _jsx("p", { className: "text-xs text-text-muted", children: error }), _jsx("button", { onClick: loadAll, className: "text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors", children: "Retry" })] }));
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 justify-end", children: [_jsx("span", { className: `text-[10px] px-2 py-0.5 rounded-full ${paused ? 'bg-amber-500/10 text-amber-400' : 'bg-green-500/10 text-green-400'}`, children: paused ? 'PAUSED' : 'ACTIVE' }), _jsx("span", { className: "text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400", children: "Mock Broker" })] }), status && (_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [_jsxs("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-text-muted mb-1", children: [_jsx(Wallet, { size: 14 }), _jsx("span", { className: "text-[10px] font-medium", children: "Total Value" })] }), _jsxs("div", { className: "text-lg font-bold text-text", children: ["\u20A9", (status.total_value ?? 0).toLocaleString()] })] }), _jsxs("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-text-muted mb-1", children: [_jsx(TrendingUp, { size: 14 }), _jsx("span", { className: "text-[10px] font-medium", children: "Cash" })] }), _jsxs("div", { className: "text-lg font-bold text-blue-400", children: ["\u20A9", (status.cash ?? 0).toLocaleString()] })] }), _jsxs("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-text-muted mb-1", children: [_jsx(Activity, { size: 14 }), _jsx(Tooltip, { content: findGlossary('maxPositions')?.description ?? 'Positions', children: _jsx("span", { className: "text-[10px] font-medium", children: "Positions" }) })] }), _jsx("div", { className: "text-lg font-bold text-amber-400", children: status.positions_count ?? 0 })] }), _jsxs("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-text-muted mb-1", children: [_jsx(TrendingDown, { size: 14 }), _jsx("span", { className: "text-[10px] font-medium", children: "Total P&L" })] }), _jsxs("div", { className: `text-lg font-bold font-mono tabular-nums flex items-center gap-1 ${(status.total_pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [(status.total_pnl ?? 0) >= 0 ? '+' : '', "\u20A9", Math.abs(status.total_pnl ?? 0).toLocaleString(), pnlChange !== null && (_jsxs("span", { className: `text-[10px] ${(pnlChange ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'} animate-pulse`, children: [(pnlChange ?? 0) >= 0 ? '+' : '', "\u20A9", Math.abs(pnlChange ?? 0).toLocaleString()] }))] })] })] })), _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsxs("button", { onClick: generateAndExecute, disabled: execLoading || paused, className: "flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50", children: [_jsx(Play, { size: 12 }), " ", execLoading ? 'Running...' : 'Generate & Execute'] }), _jsxs("button", { onClick: runFullCycle, disabled: cycleLoading || paused, className: "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-border text-text hover:bg-surface-hover transition-colors disabled:opacity-50", children: [_jsx(RefreshCw, { size: 12 }), " ", cycleLoading ? 'Running...' : 'Full Cycle'] }), _jsxs("button", { onClick: togglePause, className: "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 font-medium hover:bg-amber-500/20 transition-colors", children: [paused ? _jsx(PlayCircle, { size: 12 }) : _jsx(Pause, { size: 12 }), paused ? 'Resume' : 'Pause'] }), _jsx("button", { onClick: loadAll, className: "p-2 text-text-muted hover:text-text transition-colors", children: _jsx(RefreshCw, { size: 14 }) }), _jsxs("label", { className: "flex items-center gap-1.5 text-xs text-text-muted ml-2", children: [_jsx("input", { type: "checkbox", checked: autoRefresh, onChange: e => setAutoRefresh(e.target.checked), className: "rounded border-surface-border bg-surface text-primary focus:ring-primary/40" }), "Auto"] })] }), execResult && (_jsx("div", { className: `text-xs px-3 py-2 rounded-lg ${execResult.startsWith('Error') ? 'bg-red-500/10 text-red-400' : 'bg-primary/10 text-primary'}`, children: execResult })), signals.length > 0 && showSignals && (_jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsxs("div", { className: "p-3 border-b border-surface-border flex items-center justify-between", children: [_jsxs("h3", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: ["Signals Generated (", signals.length, ")"] }), _jsx("button", { onClick: () => setShowSignals(false), className: "text-text-muted hover:text-text text-xs", children: "Close" })] }), _jsx("div", { className: "divide-y divide-surface-border max-h-40 overflow-y-auto", children: signals.map((sig, i) => (_jsxs("div", { className: "px-4 py-2 text-[11px] flex items-center gap-2", children: [_jsx("span", { className: `px-1.5 py-0.5 rounded-full text-[10px] font-medium ${sig.signal === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`, children: sig.signal }), _jsx("span", { className: "text-text font-medium", children: sig.name }), _jsx("span", { className: "text-text-muted", children: sig.ticker }), _jsxs("span", { className: "text-text-muted ml-auto", children: ["\u20A9", sig.price.toLocaleString()] })] }, i))) })] })), _jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsxs("div", { className: "p-3 border-b border-surface-border flex items-center gap-4", children: [_jsx("h3", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Open Positions" }), _jsxs("span", { className: "text-[10px] text-text-muted", children: [positions.filter(p => p.status === 'open').length, " open"] }), positions.filter(p => p.status === 'open').length > 0 && (_jsxs("button", { onClick: () => { setShowTestExit(true); setTestExitPosId(positions.find(p => p.status === 'open')?.id ?? null); }, className: "ml-auto flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-warning/15 text-warning hover:bg-warning/25 transition-colors", children: [_jsx(LogOut, { size: 10 }), " Test Exit"] }))] }), positions.filter(p => p.status === 'open').length === 0 ? (_jsx("div", { className: "p-6 text-center text-xs text-text-muted", children: "No open positions" })) : (_jsx("div", { className: "divide-y divide-surface-border", children: positions.filter(p => p.status === 'open').map(p => (_jsxs("div", { className: "px-4 py-3 flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-sm font-medium text-text", children: p.ticker }), _jsxs("span", { className: "text-[10px] text-text-muted", children: ["S", p.strategy_id] })] }), _jsxs("div", { className: "text-[10px] text-text-muted mt-0.5", children: ["Entry: \u20A9", p.entry_price.toLocaleString(), " \u00B7 Qty: ", p.quantity] })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: `text-sm font-bold ${p.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [p.pnl_pct >= 0 ? '+' : '', p.pnl_pct.toFixed(2), "%"] }), _jsxs("div", { className: "text-[10px] text-text-muted", children: [p.pnl_amt >= 0 ? '+' : '', "\u20A9", Math.abs(p.pnl_amt).toLocaleString()] })] })] }, p.id))) }))] }), _jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsx("div", { className: "p-3 border-b border-surface-border", children: _jsx("h3", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Recent Trades" }) }), trades.length === 0 ? (_jsx("div", { className: "p-6 text-center text-xs text-text-muted", children: "No trades yet" })) : (_jsx("div", { className: "divide-y divide-surface-border max-h-60 overflow-y-auto", children: trades.slice(0, 30).map(t => (_jsxs("div", { className: "px-4 py-2 text-[11px] flex items-center gap-2", children: [_jsx("span", { className: `px-1.5 py-0.5 rounded-full text-[10px] font-medium ${t.action === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`, children: t.action }), _jsx("span", { className: "text-text font-medium", children: t.ticker }), _jsxs("span", { className: "text-text-muted", children: ["\u20A9", t.price.toLocaleString(), " x ", t.quantity] }), t.pnl_pct !== 0 && (_jsxs("span", { className: t.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400', children: [t.pnl_pct >= 0 ? '+' : '', t.pnl_pct.toFixed(2), "%"] })), _jsx("span", { className: "text-text-muted ml-auto", children: t.reason || '-' })] }, t.id))) }))] }), showTestExit && (_jsx(ConfirmDialog, { open: true, title: "Test Exit Condition", message: `Simulate exit for position #${testExitPosId}`, confirmLabel: "Run Test", loading: testExitLoading, onConfirm: runTestExit, onCancel: () => setShowTestExit(false) }))] }));
}
