import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { useLogs } from '../../hooks/useLogs';
import { Card } from '../common/Card';
import { CardSkeleton } from '../common/Skeleton';
import { formatTime } from '../../utils/format';
import { AlertCircle, Info, AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
const LOG_LEVELS = {
    error: 'ERROR', err: 'ERROR', critical: 'ERROR',
    warn: 'WARN', warning: 'WARN',
    info: 'INFO',
};
const levelConfig = {
    ERROR: { icon: AlertCircle, color: 'text-danger', bg: 'bg-danger/10' },
    WARN: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
    INFO: { icon: Info, color: 'text-primary', bg: 'bg-primary/10' },
};
function resolveLevel(logType) {
    return LOG_LEVELS[logType.toLowerCase()] || 'INFO';
}
function displayLabel(logType) {
    const lower = logType.toLowerCase();
    if (LOG_LEVELS[lower])
        return LOG_LEVELS[lower];
    return logType;
}
export function LogViewer() {
    const { logs, loading, refetch } = useLogs();
    const [showAll, setShowAll] = useState(false);
    const timerRef = useRef();
    useEffect(() => {
        timerRef.current = setInterval(refetch, 30000);
        return () => clearInterval(timerRef.current);
    }, [refetch]);
    if (loading)
        return _jsx(CardSkeleton, {});
    const display = showAll ? logs.slice(0, 50) : logs.slice(0, 5);
    const hasMore = logs.length > 5;
    return (_jsxs(Card, { children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h2", { className: "text-sm font-semibold text-text-primary", children: "\uC2DC\uC2A4\uD15C \uB85C\uADF8" }), _jsx("button", { onClick: refetch, className: "text-text-muted hover:text-text-primary transition-colors min-h-[24px] min-w-[24px] flex items-center justify-center", children: _jsx(RefreshCw, { size: 12 }) })] }), logs.length > 0 && (_jsxs("span", { className: "text-[11px] text-text-muted", children: [logs.length, "\uAC74"] }))] }), display.length === 0 ? (_jsx("p", { className: "text-xs text-text-muted py-4 text-center", children: "\uB85C\uADF8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4" })) : (_jsx("div", { className: "space-y-1", children: display.map((l) => {
                    const raw = l.log_type || 'INFO';
                    const level = resolveLevel(raw);
                    const cfg = levelConfig[level] || levelConfig.INFO;
                    const Icon = cfg.icon;
                    return (_jsxs("div", { className: "flex items-start gap-2.5 py-2 border-b border-surface-border last:border-0", children: [_jsx("div", { className: `mt-0.5 ${cfg.color}`, children: _jsx(Icon, { size: 13 }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-0.5", children: [_jsx("span", { className: `text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`, children: displayLabel(raw) }), _jsx("span", { className: "text-[10px] text-text-muted font-mono", children: l.source }), _jsx("span", { className: "text-[10px] text-text-muted/60 font-mono tabular-nums ml-auto", children: formatTime(l.created_at) })] }), _jsx("div", { className: "text-xs text-text-primary leading-snug", children: l.message })] })] }, l.id));
                }) })), hasMore && (_jsx("button", { onClick: () => setShowAll(!showAll), className: "w-full flex items-center justify-center gap-1 text-xs text-text-muted hover:text-text-primary mt-2 min-h-[36px] transition-colors", children: showAll ? (_jsxs(_Fragment, { children: ["\uC811\uAE30 ", _jsx(ChevronUp, { size: 14 })] })) : (_jsxs(_Fragment, { children: ["\uCD5C\uADFC ", logs.length, "\uAC74 \uBAA8\uB450 \uBCF4\uAE30 ", _jsx(ChevronDown, { size: 14 })] })) }))] }));
}
