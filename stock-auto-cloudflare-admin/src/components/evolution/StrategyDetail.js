import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, TrendingUp, TrendingDown, Activity, Zap, BarChart3, GitBranch } from 'lucide-react';
function DetailContent({ strategy, onClose }) {
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);
    const s = strategy;
    const p = s.params;
    const ind = s.indicators;
    const paramRows = [
        { label: 'Entry Type', value: p?.entry_type, icon: Zap },
        { label: 'Entry Trigger', value: p?.entry_trigger, icon: Activity },
        { label: 'Min Volume', value: p?.min_volume?.toLocaleString(), icon: BarChart3 },
        { label: 'Max Volatility', value: p?.max_volatility ? `${(p.max_volatility * 100).toFixed(1)}%` : '-', icon: TrendingDown },
        { label: 'Take Profit', value: p?.fixed_take_profit_pct ? `${(p.fixed_take_profit_pct * 100).toFixed(1)}%` : '-', icon: TrendingUp },
        { label: 'Stop Loss', value: p?.stop_loss_pct ? `${(p.stop_loss_pct * 100).toFixed(1)}%` : '-', icon: TrendingDown },
        { label: 'Trailing Stop', value: p?.trailing_stop_pct ? `${(p.trailing_stop_pct * 100).toFixed(1)}%` : '-', icon: GitBranch },
        { label: 'Stall Exit', value: p?.stall_exit_days ? `${p.stall_exit_days}d` : '-', icon: X },
    ];
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-end sm:items-center justify-center", children: [_jsx("div", { className: "absolute inset-0 bg-black/40", onClick: onClose }), _jsxs("div", { className: "relative w-full max-w-md bg-surface-card rounded-t-2xl sm:rounded-2xl max-h-[80vh] overflow-y-auto border border-surface-border", children: [_jsxs("div", { className: "sticky top-0 bg-surface-card border-b border-surface-border px-4 py-3 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [s.is_elite && _jsx(ShieldCheck, { size: 16, className: "text-amber-400" }), _jsx("h3", { className: "text-sm font-bold text-text", children: s.name }), s.is_elite && (_jsx("span", { className: "text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium", children: "ELITE" }))] }), _jsx("button", { onClick: onClose, className: "p-1 text-text-muted hover:text-text", children: _jsx(X, { size: 16 }) })] }), _jsxs("div", { className: "p-4 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(StatCard, { label: "Generation", value: `#${s.generation}`, color: "text-primary" }), _jsx(StatCard, { label: "Version", value: `v${s.version}`, color: "text-blue-400" }), _jsx(StatCard, { label: "Total Return", value: s.total_trades > 0 ? `${s.total_return >= 0 ? '+' : ''}${s.total_return.toFixed(2)}%` : '-', color: s.total_return >= 0 ? 'text-green-400' : 'text-red-400' }), _jsx(StatCard, { label: "Win Rate", value: s.total_trades > 0 ? `${s.win_rate.toFixed(1)}%` : '-', color: s.win_rate >= 50 ? 'text-green-400' : 'text-red-400' }), _jsx(StatCard, { label: "Max DD", value: s.total_trades > 0 ? `${s.max_drawdown.toFixed(1)}%` : '-', color: "text-red-400" }), _jsx(StatCard, { label: "Trades", value: s.total_trades.toString(), color: "text-text" })] }), _jsxs("div", { children: [_jsx("h4", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider mb-2", children: "Parameters" }), _jsx("div", { className: "grid grid-cols-2 gap-1.5", children: paramRows.map((row) => {
                                            const Icon = row.icon;
                                            return (_jsxs("div", { className: "flex items-center gap-1.5 bg-surface rounded-lg px-2.5 py-1.5", children: [_jsx(Icon, { size: 10, className: "text-text-muted shrink-0" }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-[9px] text-text-muted", children: row.label }), _jsx("div", { className: "text-[11px] font-medium text-text truncate", children: row.value })] })] }, row.label));
                                        }) })] }), ind && (_jsxs("div", { children: [_jsx("h4", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider mb-2", children: "Indicators" }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: [
                                            { label: 'Volume', on: ind.use_volume_filter },
                                            { label: 'Volatility', on: ind.use_volatility_filter },
                                            { label: 'Momentum', on: ind.use_momentum },
                                            { label: 'Breakout', on: ind.use_breakout },
                                            { label: 'Pullback', on: ind.use_pullback },
                                        ].map((f) => (_jsxs("span", { className: `text-[10px] px-2 py-0.5 rounded-full font-medium ${f.on ? 'bg-green-500/10 text-green-400' : 'bg-surface-border/50 text-text-muted'}`, children: [f.label, ": ", f.on ? 'ON' : 'OFF'] }, f.label))) }), _jsxs("div", { className: "grid grid-cols-3 gap-1.5 mt-2", children: [_jsxs("div", { className: "bg-surface rounded-lg px-2 py-1.5 text-center", children: [_jsx("div", { className: "text-[9px] text-text-muted", children: "Momentum" }), _jsx("div", { className: "text-[11px] font-medium text-text", children: ind.momentum_period })] }), _jsxs("div", { className: "bg-surface rounded-lg px-2 py-1.5 text-center", children: [_jsx("div", { className: "text-[9px] text-text-muted", children: "Breakout" }), _jsx("div", { className: "text-[11px] font-medium text-text", children: ind.breakout_period })] }), _jsxs("div", { className: "bg-surface rounded-lg px-2 py-1.5 text-center", children: [_jsx("div", { className: "text-[9px] text-text-muted", children: "Pullback" }), _jsx("div", { className: "text-[11px] font-medium text-text", children: ind.pullback_threshold })] })] })] })), s.tags && s.tags.length > 0 && (_jsxs("div", { children: [_jsx("h4", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider mb-2", children: "Tags" }), _jsx("div", { className: "flex flex-wrap gap-1", children: s.tags.map((tag, i) => (_jsx("span", { className: "text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary", children: tag }, i))) })] }))] })] })] }));
}
export function StrategyDetail(props) {
    return createPortal(_jsx(DetailContent, { ...props }), document.body);
}
function StatCard({ label, value, color }) {
    return (_jsxs("div", { className: "bg-surface rounded-xl p-3", children: [_jsx("div", { className: "text-[10px] text-text-muted mb-0.5", children: label }), _jsx("div", { className: `text-sm font-bold ${color}`, children: value })] }));
}
