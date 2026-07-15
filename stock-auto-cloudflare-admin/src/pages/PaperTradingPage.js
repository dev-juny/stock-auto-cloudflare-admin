import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../utils/api';
import { useToast } from '../components/common/Toast';
import { useAction } from '../hooks/useAction';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Tooltip } from '../components/common/Tooltip';
import { findGlossary } from '../utils/glossary';
import { formatStockDisplay } from '../utils/format';
import { Wallet, TrendingUp, TrendingDown, RefreshCw, Play, XCircle, Activity, LogOut, Pause, PlayCircle, Plus, Square, RotateCcw, ChevronDown, Settings, Save, Trash2, } from 'lucide-react';
const CAPITAL_OPTIONS = [1000000, 5000000, 10000000, 50000000, 100000000];
const POSITION_SIZE_OPTIONS = [100000, 300000, 500000, 1000000, 2000000];
const MAX_POSITIONS_OPTIONS = [3, 5, 10, 20, 50];
export default function PaperTradingPage() {
    const [sessions, setSessions] = useState([]);
    const [currentSessionId, setCurrentSessionId] = useState(1);
    const [status, setStatus] = useState(null);
    const [signals, setSignals] = useState([]);
    const [scanSummary, setScanSummary] = useState(null);
    const [positions, setPositions] = useState([]);
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [execResult, setExecResult] = useState(null);
    const [showTestExit, setShowTestExit] = useState(false);
    const [testExitPosId, setTestExitPosId] = useState(null);
    const [testExitCondition, setTestExitCondition] = useState('stop_loss');
    const [showSignals, setShowSignals] = useState(false);
    const [prevPnl, setPrevPnl] = useState(null);
    const [pnlChange, setPnlChange] = useState(null);
    const [showNewSession, setShowNewSession] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showStopConfirm, setShowStopConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState(null);
    const { loading: deleteLoading, execute: deleteExec } = useAction();
    const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
    const [schedulerStatus, setSchedulerStatus] = useState('unknown');
    const [newSession, setNewSession] = useState({
        name: '',
        initial_capital: 10000000,
        max_positions: 5,
        position_size: 500000,
        commission_pct: 0,
        slippage_pct: 0,
        tax_pct: 0,
        auto_mode: false,
        custom_capital: false,
        custom_capital_value: '',
        custom_position_size: false,
        custom_position_size_value: '',
    });
    const { toast } = useToast();
    const { loading: execLoading, execute } = useAction();
    const { loading: testExitLoading, execute: testExitExec } = useAction();
    const { loading: cycleLoading, execute: cycleExec } = useAction();
    const { loading: resetLoading, execute: resetExec } = useAction();
    const { loading: stopLoading, execute: stopExec } = useAction();
    const { loading: newSessionLoading, execute: newSessionExec } = useAction();
    const { loading: pauseLoading, execute: pauseExec } = useAction();
    const { loading: resumeLoading, execute: resumeExec } = useAction();
    const intervalRef = useRef(null);
    const prevPnlRef = useRef(null);
    const apiPrefix = useCallback((path) => {
        return `${path}${path.includes('?') ? '&' : '?'}session_id=${currentSessionId}`;
    }, [currentSessionId]);
    const loadSchedulerStatus = useCallback(async () => {
        try {
            const res = await api.get('/api/scheduler/jobs/paper-trading/status');
            setSchedulerStatus(res.status);
        }
        catch {
            try {
                const schedRes = await api.get('/api/scheduler/status');
                const ptJob = (schedRes.jobs || []).find((j) => j.job_id === 'paper-trading');
                setSchedulerStatus(ptJob?.status === 'PAUSED' ? 'paused' : 'running');
            }
            catch {
                setSchedulerStatus('unknown');
            }
        }
    }, []);
    const loadSessions = useCallback(async () => {
        try {
            const res = await api.get('/api/paper-trading/sessions');
            const list = res.items || [];
            setSessions(list);
            if (list.length > 0 && !list.find(s => s.id === currentSessionId)) {
                const active = list.find(s => s.status === 'active');
                setCurrentSessionId(active ? active.id : list[0].id);
            }
        }
        catch { }
    }, [currentSessionId]);
    const loadAll = useCallback(async () => {
        try {
            setError(null);
            const [s, p, t] = await Promise.all([
                api.get(apiPrefix('/api/paper-trading/status')).catch(() => null),
                api.get(apiPrefix('/api/paper-trading/positions')).catch(() => null),
                api.get(apiPrefix('/api/paper-trading/trades')).catch(() => null),
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
    }, [apiPrefix]);
    useEffect(() => {
        loadSchedulerStatus();
        loadSessions().then(() => loadAll());
    }, [loadSessions, loadAll, loadSchedulerStatus]);
    useEffect(() => {
        if (!autoRefresh) {
            if (intervalRef.current)
                clearInterval(intervalRef.current);
            return;
        }
        intervalRef.current = setInterval(loadAll, 15000);
        return () => { if (intervalRef.current)
            clearInterval(intervalRef.current); };
    }, [autoRefresh, loadAll]);
    const currentSession = sessions.find(s => s.id === currentSessionId);
    async function handleCreateSession() {
        await newSessionExec(async () => {
            const payload = {
                name: newSession.name || `Session #${sessions.length + 1}`,
                initial_capital: newSession.custom_capital
                    ? parseInt(newSession.custom_capital_value) || 10000000
                    : newSession.initial_capital,
                max_positions: newSession.max_positions,
                position_size: newSession.custom_position_size
                    ? parseInt(newSession.custom_position_size_value) || 500000
                    : newSession.position_size,
                commission_pct: newSession.commission_pct === '' ? 0 : newSession.commission_pct,
                slippage_pct: newSession.slippage_pct === '' ? 0 : newSession.slippage_pct,
                tax_pct: newSession.tax_pct === '' ? 0 : newSession.tax_pct,
                auto_mode: newSession.auto_mode,
            };
            const sess = await api.post('/api/paper-trading/sessions', payload);
            setCurrentSessionId(sess.id);
            setShowNewSession(false);
            setNewSession({
                name: '', initial_capital: 10000000, max_positions: 5, position_size: 500000,
                commission_pct: 0, slippage_pct: 0, tax_pct: 0, auto_mode: false,
                custom_capital: false, custom_capital_value: '',
                custom_position_size: false, custom_position_size_value: '',
            });
            return sess;
        }, 'Session created');
        await loadSessions();
        await loadAll();
    }
    async function handleResetSession() {
        await resetExec(() => api.post(`/api/paper-trading/sessions/${currentSessionId}/reset`), 'Session reset');
        setShowResetConfirm(false);
        setSignals([]);
        setScanSummary(null);
        setShowSignals(false);
        await loadAll();
    }
    async function handleStopSession() {
        await stopExec(() => api.post(`/api/paper-trading/sessions/${currentSessionId}/stop`), 'Session stopped');
        setShowStopConfirm(false);
        await loadSessions();
        await loadAll();
    }
    async function handleDeleteSession() {
        if (deleteTargetId === null)
            return;
        await deleteExec(() => api.delete(`/api/paper-trading/sessions/${deleteTargetId}`), 'Session deleted');
        setShowDeleteConfirm(false);
        setDeleteTargetId(null);
        if (currentSessionId === deleteTargetId) {
            const remaining = sessions.filter(s => s.id !== deleteTargetId);
            if (remaining.length > 0)
                setCurrentSessionId(remaining[0].id);
        }
        await loadSessions();
        await loadAll();
    }
    async function selectSession(id) {
        setCurrentSessionId(id);
        setSessionMenuOpen(false);
        setSignals([]);
        setScanSummary(null);
        setShowSignals(false);
        setLoading(true);
        await loadAll();
    }
    async function generateAndExecute() {
        setShowSignals(true);
        const sig = await execute(async () => {
            const s = await api.post(apiPrefix('/api/paper-trading/signals'));
            setSignals(s.signals || []);
            setScanSummary(s.scan_summary || null);
            if ((s.signals || []).length > 0) {
                const r = await api.post(apiPrefix('/api/paper-trading/execute'), { signals: s.signals });
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
        await testExitExec(() => api.post(apiPrefix('/api/paper-trading/test-exit'), {
            pos_id: testExitPosId,
            condition: testExitCondition,
        }), 'Test exit completed');
        setShowTestExit(false);
        loadAll();
    }
    async function runFullCycle() {
        await cycleExec(() => api.post(apiPrefix('/api/paper-trading/run-cycle')), 'Full cycle completed');
        loadAll();
    }
    async function handlePauseScheduler() {
        await pauseExec(() => api.post('/api/scheduler/jobs/paper-trading/pause'), 'Scheduler paused');
        setSchedulerStatus('paused');
    }
    async function handleResumeScheduler() {
        await resumeExec(() => api.post('/api/scheduler/jobs/paper-trading/resume'), 'Scheduler resumed');
        setSchedulerStatus('running');
    }
    if (loading) {
        return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "skeleton h-5 w-32" }), _jsx("div", { className: "skeleton h-5 w-20" })] }), _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [1, 2, 3, 4].map(i => (_jsxs("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: [_jsx("div", { className: "skeleton h-3 w-16 mb-2" }), _jsx("div", { className: "skeleton h-6 w-24" })] }, i))) })] }));
    }
    if (error) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center h-48 gap-3", children: [_jsx(XCircle, { size: 24, className: "text-red-400" }), _jsx("p", { className: "text-xs text-text-muted", children: error }), _jsx("button", { onClick: loadAll, className: "text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors", children: "Retry" })] }));
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsxs("div", { className: "relative", children: [_jsxs("button", { onClick: () => setSessionMenuOpen(!sessionMenuOpen), className: "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-card border border-surface-border text-text hover:bg-surface-hover transition-colors", children: [_jsx(PlayCircle, { size: 12, className: "text-primary" }), _jsx("span", { className: "font-medium", children: currentSession?.name || `Session #${currentSessionId}` }), _jsx(ChevronDown, { size: 12, className: "text-text-muted" })] }), sessionMenuOpen && (_jsx("div", { className: "absolute top-full left-0 mt-1 z-50 bg-surface-card border border-surface-border rounded-xl shadow-xl min-w-[200px] max-h-60 overflow-y-auto", children: sessions.map(s => (_jsxs("div", { className: `flex items-center px-3 py-2 text-xs hover:bg-surface-hover transition-colors ${s.id === currentSessionId ? 'bg-primary/10 text-primary' : 'text-text'} ${s.status !== 'active' ? 'opacity-60' : ''}`, children: [_jsxs("button", { onClick: () => selectSession(s.id), className: "flex items-center gap-2 flex-1 text-left", children: [_jsx("span", { className: `w-1.5 h-1.5 rounded-full ${s.status === 'active' ? 'bg-green-400' : 'bg-text-muted'}` }), _jsx("span", { className: "font-medium", children: s.name }), _jsx("span", { className: "ml-auto text-[10px] text-text-muted", children: s.status === 'active' ? 'Active' : s.status })] }), _jsx("button", { onClick: (e) => { e.stopPropagation(); setDeleteTargetId(s.id); setShowDeleteConfirm(true); }, className: "ml-2 p-1 rounded-md hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors", title: "Delete session", children: _jsx(Trash2, { size: 12 }) })] }, s.id))) }))] }), _jsxs("div", { className: "flex items-center gap-1 text-[10px] text-text-muted", children: [_jsx("span", { className: `px-1.5 py-0.5 rounded-full ${status?.session_status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`, children: status?.session_status === 'active' ? 'ACTIVE' : status?.session_status?.toUpperCase() }), _jsx("span", { className: `px-1.5 py-0.5 rounded-full ${schedulerStatus === 'running' ? 'bg-green-500/10 text-green-400' :
                                    schedulerStatus === 'paused' ? 'bg-amber-500/10 text-amber-400' :
                                        'bg-text-muted/10 text-text-muted'}`, children: schedulerStatus === 'running' ? 'SCHEDULER RUNNING' :
                                    schedulerStatus === 'paused' ? 'SCHEDULER PAUSED' : 'SCHEDULER UNKNOWN' }), _jsx("span", { className: "px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400", children: "Mock Broker" })] })] }), status && (_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [_jsxs("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-text-muted mb-1", children: [_jsx(Wallet, { size: 14 }), _jsx("span", { className: "text-[10px] font-medium", children: "Total Value" })] }), _jsxs("div", { className: "text-lg font-bold text-text", children: ["\u20A9", (status.total_value ?? 0).toLocaleString()] })] }), _jsxs("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-text-muted mb-1", children: [_jsx(TrendingUp, { size: 14 }), _jsx("span", { className: "text-[10px] font-medium", children: "Cash" })] }), _jsxs("div", { className: "text-lg font-bold text-blue-400", children: ["\u20A9", (status.cash ?? 0).toLocaleString()] })] }), _jsxs("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-text-muted mb-1", children: [_jsx(Activity, { size: 14 }), _jsx(Tooltip, { content: findGlossary('maxPositions')?.description ?? 'Positions', children: _jsx("span", { className: "text-[10px] font-medium", children: "Positions" }) })] }), _jsx("div", { className: "text-lg font-bold text-amber-400", children: status.positions_count ?? 0 })] }), _jsxs("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-text-muted mb-1", children: [_jsx(TrendingDown, { size: 14 }), _jsx("span", { className: "text-[10px] font-medium", children: "Total P&L" })] }), _jsxs("div", { className: `text-lg font-bold font-mono tabular-nums flex items-center gap-1 ${(status.total_pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [(status.total_pnl ?? 0) >= 0 ? '+' : '', "\u20A9", Math.abs(status.total_pnl ?? 0).toLocaleString(), pnlChange !== null && (_jsxs("span", { className: `text-[10px] ${(pnlChange ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'} animate-pulse`, children: [(pnlChange ?? 0) >= 0 ? '+' : '', "\u20A9", Math.abs(pnlChange ?? 0).toLocaleString()] }))] })] })] })), status?.session_status !== 'active' && currentSession && (currentSession.final_total != null) && (_jsxs("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: [_jsx("h3", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider mb-2", children: "Session Summary" }), _jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]", children: [_jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Initial Capital" }), _jsxs("div", { className: "text-text font-medium", children: ["\u20A9", (currentSession.initial_capital ?? 0).toLocaleString()] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Final Total" }), _jsxs("div", { className: "text-text font-medium", children: ["\u20A9", (currentSession.final_total ?? 0).toLocaleString()] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Return" }), _jsxs("div", { className: `font-medium ${((currentSession.final_total ?? 0) - (currentSession.initial_capital ?? 0)) >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [((((currentSession.final_total ?? 0) - (currentSession.initial_capital ?? 0)) / (currentSession.initial_capital ?? 1)) * 100).toFixed(2), "%"] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Ended" }), _jsx("div", { className: "text-text font-medium", children: currentSession.ended_at ? new Date(currentSession.ended_at).toLocaleDateString() : '-' })] })] })] })), _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsxs("button", { onClick: () => setShowNewSession(true), className: "flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors", children: [_jsx(Plus, { size: 12 }), " New Paper Trading"] }), status?.session_status === 'active' && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: generateAndExecute, disabled: execLoading, className: "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-border text-text hover:bg-surface-hover transition-colors disabled:opacity-50", children: [_jsx(Play, { size: 12 }), " ", execLoading ? 'Running...' : 'Generate & Execute'] }), _jsxs("button", { onClick: runFullCycle, disabled: cycleLoading, className: "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-border text-text hover:bg-surface-hover transition-colors disabled:opacity-50", children: [_jsx(RefreshCw, { size: 12 }), " ", cycleLoading ? 'Running...' : 'Full Cycle'] }), _jsxs("button", { onClick: () => setShowResetConfirm(true), className: "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors", children: [_jsx(RotateCcw, { size: 12 }), " Reset"] }), _jsxs("button", { onClick: () => setShowStopConfirm(true), className: "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors", children: [_jsx(Square, { size: 12 }), " Stop"] }), schedulerStatus === 'running' ? (_jsxs("button", { onClick: handlePauseScheduler, disabled: pauseLoading, className: "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-warning/15 text-warning hover:bg-warning/25 transition-colors disabled:opacity-50", children: [_jsx(Pause, { size: 12 }), " ", pauseLoading ? 'Pausing...' : 'Pause Scheduler'] })) : (_jsxs("button", { onClick: handleResumeScheduler, disabled: resumeLoading, className: "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50", children: [_jsx(PlayCircle, { size: 12 }), " ", resumeLoading ? 'Resuming...' : 'Resume Scheduler'] }))] })), _jsx("button", { onClick: loadAll, className: "p-2 text-text-muted hover:text-text transition-colors", children: _jsx(RefreshCw, { size: 14 }) }), _jsxs("label", { className: "flex items-center gap-1.5 text-xs text-text-muted ml-2", children: [_jsx("input", { type: "checkbox", checked: autoRefresh, onChange: e => setAutoRefresh(e.target.checked), className: "rounded border-surface-border bg-surface text-primary focus:ring-primary/40" }), "Auto"] })] }), execResult && (_jsx("div", { className: `text-xs px-3 py-2 rounded-lg ${execResult.startsWith('Error') ? 'bg-red-500/10 text-red-400' : 'bg-primary/10 text-primary'}`, children: execResult })), scanSummary && showSignals && (_jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsx("div", { className: "p-3 border-b border-surface-border", children: _jsx("h3", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Signal Scan Summary" }) }), _jsxs("div", { className: "p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]", children: [_jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Strategies Scanned" }), _jsx("div", { className: "text-text font-medium", children: scanSummary.strategies_scanned })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Universe Total" }), _jsx("div", { className: "text-text font-medium", children: scanSummary.universe_total })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Momentum Pass" }), _jsx("div", { className: "text-green-400 font-medium", children: scanSummary.momentum_pass })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Breakout Pass" }), _jsx("div", { className: "text-blue-400 font-medium", children: scanSummary.breakout_pass })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Pullback Pass" }), _jsx("div", { className: "text-purple-400 font-medium", children: scanSummary.pullback_pass })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Volume Fail" }), _jsx("div", { className: "text-text-muted font-medium", children: scanSummary.volume_fail })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Risk Reject" }), _jsx("div", { className: "text-amber-400 font-medium", children: scanSummary.risk_reject })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Signals Generated" }), _jsx("div", { className: `font-bold ${scanSummary.generated > 0 ? 'text-green-400' : 'text-red-400'}`, children: scanSummary.generated })] })] })] })), signals.length > 0 && showSignals && (_jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsxs("div", { className: "p-3 border-b border-surface-border flex items-center justify-between", children: [_jsxs("h3", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: ["Signals Generated (", signals.length, ")"] }), _jsx("button", { onClick: () => setShowSignals(false), className: "text-text-muted hover:text-text text-xs", children: "Close" })] }), _jsx("div", { className: "divide-y divide-surface-border max-h-40 overflow-y-auto", children: signals.map((sig, i) => (_jsxs("div", { className: "px-4 py-2 text-[11px] flex items-center gap-2", children: [_jsx("span", { className: `px-1.5 py-0.5 rounded-full text-[10px] font-medium ${sig.signal === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`, children: sig.signal }), _jsx("span", { className: "text-text font-medium", children: sig.name }), _jsx("span", { className: "text-text-muted", children: sig.ticker }), _jsxs("span", { className: "text-text-muted ml-auto", children: ["\u20A9", sig.price.toLocaleString()] })] }, i))) })] })), scanSummary && scanSummary.generated === 0 && showSignals && (_jsx("div", { className: "bg-surface-card rounded-2xl border border-surface-border p-4 text-center text-xs text-text-muted", children: "No buy signals generated. Check scan summary above for details." })), _jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsxs("div", { className: "p-3 border-b border-surface-border flex items-center gap-4", children: [_jsx("h3", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Open Positions" }), _jsxs("span", { className: "text-[10px] text-text-muted", children: [positions.filter(p => p.status === 'open').length, " open"] }), positions.filter(p => p.status === 'open').length > 0 && (_jsxs("button", { onClick: () => { setShowTestExit(true); setTestExitPosId(positions.find(p => p.status === 'open')?.id ?? null); }, className: "ml-auto flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-warning/15 text-warning hover:bg-warning/25 transition-colors", children: [_jsx(LogOut, { size: 10 }), " Test Exit"] }))] }), positions.filter(p => p.status === 'open').length === 0 ? (_jsx("div", { className: "p-6 text-center text-xs text-text-muted", children: "No open positions" })) : (_jsx("div", { className: "divide-y divide-surface-border", children: positions.filter(p => p.status === 'open').map(p => (_jsxs("div", { className: "px-4 py-3 flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-sm font-medium text-text", children: formatStockDisplay(p.name, p.ticker) }), _jsxs("span", { className: "text-[10px] text-text-muted", children: ["S", p.strategy_id] })] }), _jsxs("div", { className: "text-[10px] text-text-muted mt-0.5", children: ["Entry: \u20A9", p.entry_price.toLocaleString(), " \u00B7 Qty: ", p.quantity] })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: `text-sm font-bold ${p.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [p.pnl_pct >= 0 ? '+' : '', p.pnl_pct.toFixed(2), "%"] }), _jsxs("div", { className: "text-[10px] text-text-muted", children: [p.pnl_amt >= 0 ? '+' : '', "\u20A9", Math.abs(p.pnl_amt).toLocaleString()] })] })] }, p.id))) }))] }), _jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsx("div", { className: "p-3 border-b border-surface-border", children: _jsx("h3", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Recent Trades" }) }), trades.length === 0 ? (_jsx("div", { className: "p-6 text-center text-xs text-text-muted", children: "No trades yet" })) : (_jsx("div", { className: "divide-y divide-surface-border max-h-60 overflow-y-auto", children: trades.slice(0, 30).map(t => (_jsxs("div", { className: "px-4 py-2 text-[11px] flex items-center gap-2", children: [_jsx("span", { className: `px-1.5 py-0.5 rounded-full text-[10px] font-medium ${t.action === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`, children: t.action }), _jsx("span", { className: "text-text font-medium", children: formatStockDisplay(t.name, t.ticker) }), _jsxs("span", { className: "text-text-muted", children: ["\u20A9", t.price.toLocaleString(), " x ", t.quantity] }), t.pnl_pct !== 0 && (_jsxs("span", { className: t.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400', children: [t.pnl_pct >= 0 ? '+' : '', t.pnl_pct.toFixed(2), "%"] })), _jsx("span", { className: "text-text-muted ml-auto", children: t.reason || '-' })] }, t.id))) }))] }), showTestExit && (_jsx(ConfirmDialog, { open: true, title: "Test Exit Condition", message: `Simulate exit for position #${testExitPosId}`, confirmLabel: "Run Test", loading: testExitLoading, onConfirm: runTestExit, onCancel: () => setShowTestExit(false) })), _jsx(ConfirmDialog, { open: showResetConfirm, title: "Reset Session", message: `Reset session "${currentSession?.name || `#${currentSessionId}`}"? All positions, trades, and signals will be cleared.`, confirmLabel: "Reset", variant: "danger", loading: resetLoading, onConfirm: handleResetSession, onCancel: () => setShowResetConfirm(false) }), _jsx(ConfirmDialog, { open: showStopConfirm, title: "Stop Session", message: `End session "${currentSession?.name || `#${currentSessionId}`}"? Open positions will be closed.`, confirmLabel: "Stop", variant: "danger", loading: stopLoading, onConfirm: handleStopSession, onCancel: () => setShowStopConfirm(false) }), _jsx(ConfirmDialog, { open: showDeleteConfirm, title: "Delete Session", message: `Delete session "${sessions.find(s => s.id === deleteTargetId)?.name || `#${deleteTargetId}`}"? All positions, trades, and history will be permanently removed.`, confirmLabel: "Delete", variant: "danger", loading: deleteLoading, onConfirm: handleDeleteSession, onCancel: () => { setShowDeleteConfirm(false); setDeleteTargetId(null); } }), showNewSession && (_jsx("div", { className: "fixed inset-0 z-[60] flex items-center justify-center bg-black/40", onClick: () => setShowNewSession(false), children: _jsxs("div", { className: "bg-surface-card border border-surface-border rounded-2xl p-5 max-w-lg w-full mx-3 shadow-xl max-h-[90vh] overflow-y-auto", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center gap-3 mb-4", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center", children: _jsx(Settings, { size: 16, className: "text-primary" }) }), _jsx("h3", { className: "text-sm font-semibold text-text", children: "New Paper Trading Session" }), _jsx("button", { onClick: () => setShowNewSession(false), className: "ml-auto text-text-muted hover:text-text", children: _jsx(XCircle, { size: 14 }) })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-[11px] font-medium text-text-muted mb-1 block", children: "Session Name" }), _jsx("input", { type: "text", value: newSession.name, onChange: e => setNewSession({ ...newSession, name: e.target.value }), placeholder: `Session #${sessions.length + 1}`, className: "w-full text-xs px-3 py-2 rounded-lg bg-surface border border-surface-border text-text placeholder-text-muted focus:outline-none focus:border-primary/50" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-[11px] font-medium text-text-muted mb-1 block", children: "Initial Capital" }), _jsx("div", { className: "flex flex-wrap gap-1.5 mb-2", children: CAPITAL_OPTIONS.map(v => (_jsxs("button", { onClick: () => setNewSession({ ...newSession, initial_capital: v, custom_capital: false, custom_capital_value: '' }), className: `text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${!newSession.custom_capital && newSession.initial_capital === v
                                                    ? 'bg-primary/15 text-primary border-primary/30'
                                                    : 'bg-surface border-surface-border text-text-muted hover:border-text-muted'}`, children: ["\u20A9", v.toLocaleString()] }, v))) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: newSession.custom_capital, onChange: e => setNewSession({ ...newSession, custom_capital: e.target.checked }), className: "rounded border-surface-border bg-surface text-primary focus:ring-primary/40" }), _jsx("span", { className: "text-[10px] text-text-muted", children: "Custom" }), newSession.custom_capital && (_jsx("input", { type: "number", value: newSession.custom_capital_value, onChange: e => setNewSession({ ...newSession, custom_capital_value: e.target.value }), placeholder: "Enter amount", className: "flex-1 text-xs px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-text placeholder-text-muted focus:outline-none focus:border-primary/50" }))] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-[11px] font-medium text-text-muted mb-1 block", children: "Position Size (Max per trade)" }), _jsx("div", { className: "flex flex-wrap gap-1.5 mb-2", children: POSITION_SIZE_OPTIONS.map(v => (_jsxs("button", { onClick: () => setNewSession({ ...newSession, position_size: v, custom_position_size: false, custom_position_size_value: '' }), className: `text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${!newSession.custom_position_size && newSession.position_size === v
                                                    ? 'bg-primary/15 text-primary border-primary/30'
                                                    : 'bg-surface border-surface-border text-text-muted hover:border-text-muted'}`, children: ["\u20A9", v.toLocaleString()] }, v))) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: newSession.custom_position_size, onChange: e => setNewSession({ ...newSession, custom_position_size: e.target.checked }), className: "rounded border-surface-border bg-surface text-primary focus:ring-primary/40" }), _jsx("span", { className: "text-[10px] text-text-muted", children: "Custom" }), newSession.custom_position_size && (_jsx("input", { type: "number", value: newSession.custom_position_size_value, onChange: e => setNewSession({ ...newSession, custom_position_size_value: e.target.value }), placeholder: "Enter amount", className: "flex-1 text-xs px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-text placeholder-text-muted focus:outline-none focus:border-primary/50" }))] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-[11px] font-medium text-text-muted mb-1 block", children: "Max Positions" }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: MAX_POSITIONS_OPTIONS.map(v => (_jsx("button", { onClick: () => setNewSession({ ...newSession, max_positions: v }), className: `text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${newSession.max_positions === v
                                                    ? 'bg-primary/15 text-primary border-primary/30'
                                                    : 'bg-surface border-surface-border text-text-muted hover:border-text-muted'}`, children: v }, v))) })] }), _jsx("div", { children: _jsxs("label", { className: "flex items-center gap-2 text-xs text-text cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: newSession.auto_mode, onChange: e => setNewSession({ ...newSession, auto_mode: e.target.checked }), className: "rounded border-surface-border bg-surface text-primary focus:ring-primary/40" }), "Auto Cycle (run automatically every hour during market hours)"] }) }), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "text-[10px] font-medium text-text-muted mb-1 block", children: "Commission (%)" }), _jsx("input", { type: "number", value: newSession.commission_pct, step: "0.01", onChange: e => { const r = e.target.value; setNewSession({ ...newSession, commission_pct: r === '' ? '' : (parseFloat(r) || 0) }); }, className: "w-full text-xs px-2 py-1.5 rounded-lg bg-surface border border-surface-border text-text focus:outline-none focus:border-primary/50" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-[10px] font-medium text-text-muted mb-1 block", children: "Slippage (%)" }), _jsx("input", { type: "number", value: newSession.slippage_pct, step: "0.01", onChange: e => { const r = e.target.value; setNewSession({ ...newSession, slippage_pct: r === '' ? '' : (parseFloat(r) || 0) }); }, className: "w-full text-xs px-2 py-1.5 rounded-lg bg-surface border border-surface-border text-text focus:outline-none focus:border-primary/50" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-[10px] font-medium text-text-muted mb-1 block", children: "Tax (%)" }), _jsx("input", { type: "number", value: newSession.tax_pct, step: "0.01", onChange: e => { const r = e.target.value; setNewSession({ ...newSession, tax_pct: r === '' ? '' : (parseFloat(r) || 0) }); }, className: "w-full text-xs px-2 py-1.5 rounded-lg bg-surface border border-surface-border text-text focus:outline-none focus:border-primary/50" })] })] }), _jsxs("div", { className: "flex items-center gap-2 justify-end pt-2 border-t border-surface-border", children: [_jsx("button", { onClick: () => setShowNewSession(false), className: "text-xs px-3 py-1.5 rounded-lg bg-surface-border text-text-muted hover:text-text transition-colors", children: "Cancel" }), _jsxs("button", { onClick: handleCreateSession, disabled: newSessionLoading, className: "flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50", children: [_jsx(Save, { size: 12 }), " ", newSessionLoading ? 'Creating...' : 'Create Session'] })] })] })] }) }))] }));
}
