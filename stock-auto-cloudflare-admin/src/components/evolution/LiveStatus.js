import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Activity } from 'lucide-react';
export function LiveStatus({ status, generationCount, strategyCount }) {
    if (!status) {
        return (_jsx("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: _jsx("p", { className: "text-xs text-text-muted", children: "Loading evolution status..." }) }));
    }
    const items = [
        { label: 'Generation', value: `#${status.current_generation}` },
        { label: 'Strategies', value: strategyCount.toString() },
        { label: 'Total Gens', value: generationCount.toString() },
        { label: 'Progress', value: status.is_running ? `${status.progress_pct}%` : '-' },
        { label: 'Last Run', value: status.last_run_at_kst || status.last_run_at || '-' },
        { label: 'Next Run', value: status.next_scheduled_run_kst || status.next_scheduled_run || '-' },
    ];
    return (_jsxs("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: [_jsxs("div", { className: "flex items-center gap-1.5 mb-3", children: [_jsx(Activity, { size: 14, className: "text-primary" }), _jsx("span", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Live Status" }), status.current_operation && (_jsx("span", { className: "text-[10px] text-primary ml-1", children: status.current_operation }))] }), _jsx("div", { className: "grid grid-cols-3 sm:grid-cols-6 gap-3", children: items.map((item) => (_jsxs("div", { children: [_jsx("div", { className: "text-[10px] text-text-muted mb-0.5", children: item.label }), _jsx("div", { className: "text-sm font-semibold text-text truncate", children: item.value })] }, item.label))) })] }));
}
