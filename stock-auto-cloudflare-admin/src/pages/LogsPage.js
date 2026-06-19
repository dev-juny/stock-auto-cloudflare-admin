import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { AlertCircle, Info, AlertTriangle, Bug, RefreshCw, Filter } from 'lucide-react';
import { formatKST } from '../utils/kst';
const logTypeMeta = {
    info: { icon: Info, color: 'text-blue-400' },
    warning: { icon: AlertTriangle, color: 'text-amber-400' },
    error: { icon: AlertCircle, color: 'text-red-400' },
    debug: { icon: Bug, color: 'text-text-muted' },
};
const typeFilters = ['all', 'info', 'warning', 'error', 'debug'];
export default function LogsPage() {
    const [logs, setLogs] = useState([]);
    const [typeFilter, setTypeFilter] = useState('all');
    useEffect(() => {
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, [typeFilter]);
    async function load() {
        try {
            const path = typeFilter === 'all' ? '/api/logs' : `/api/logs?log_type=${typeFilter}`;
            const data = await api.get(path);
            setLogs(data || []);
        }
        catch { }
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-bold text-text", children: "System Logs" }), _jsx("button", { onClick: load, className: "p-2 text-text-muted hover:text-text transition-colors", children: _jsx(RefreshCw, { size: 14 }) })] }), _jsx("div", { className: "flex gap-1.5 overflow-x-auto pb-1", children: typeFilters.map((t) => (_jsxs("button", { onClick: () => setTypeFilter(t), className: `flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded-full whitespace-nowrap transition-colors ${typeFilter === t ? 'bg-primary text-white' : 'bg-surface-card text-text-muted border border-surface-border'}`, children: [t === 'all' && _jsx(Filter, { size: 10 }), t === 'error' && _jsx(AlertCircle, { size: 10 }), t === 'warning' && _jsx(AlertTriangle, { size: 10 }), t.toUpperCase()] }, t))) }), _jsx("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: logs.length === 0 ? (_jsx("div", { className: "p-6 text-center text-xs text-text-muted", children: "No logs found" })) : (_jsx("div", { className: "divide-y divide-surface-border max-h-[65vh] overflow-y-auto", children: logs.map((log) => {
                        const meta = logTypeMeta[log.log_type] || { icon: Info, color: 'text-text-muted' };
                        const Icon = meta.icon;
                        const isError = log.log_type === 'error';
                        return (_jsx("div", { className: `px-4 py-2.5 ${isError ? 'bg-red-500/5' : ''}`, children: _jsxs("div", { className: "flex items-start gap-2", children: [_jsx(Icon, { size: 14, className: `mt-0.5 shrink-0 ${meta.color}` }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `text-[11px] font-medium ${meta.color}`, children: log.log_type.toUpperCase() }), log.source && _jsx("span", { className: "text-[10px] text-text-muted", children: log.source }), log.created_at && (_jsx("span", { className: "text-[9px] text-text-muted ml-auto shrink-0", children: log.created_at_kst || formatKST(log.created_at) }))] }), _jsx("p", { className: "text-xs text-text mt-0.5 break-words", children: log.message }), log.details && typeof log.details === 'string' && log.details !== 'null' && (_jsx("pre", { className: "text-[9px] text-text-muted mt-1 bg-surface rounded p-1.5 overflow-x-auto max-h-20", children: log.details }))] })] }) }, log.id));
                    }) })) })] }));
}
