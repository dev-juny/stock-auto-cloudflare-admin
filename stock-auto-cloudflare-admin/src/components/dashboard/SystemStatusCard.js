import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Clock, Database, Server, RefreshCw, Activity, AlertTriangle } from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { CardSkeleton } from '../common/Skeleton';
export function SystemStatusCard({ dash, loading, onRefresh }) {
    if (loading)
        return _jsx(CardSkeleton, {});
    const sys = dash?.system;
    const risk = dash?.risk;
    const blocked = risk?.blocked ?? false;
    const exposure = sys?.exposure_pct ?? 0;
    const cashRatio = sys?.cash_ratio_pct ?? 0;
    const openPositions = sys?.open_positions ?? 0;
    const sellTrades = sys?.sell_trades ?? 0;
    return (_jsxs(Card, { children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h2", { className: "text-sm font-semibold text-text-primary", children: "\uC2DC\uC2A4\uD15C \uC0C1\uD0DC" }), _jsx("button", { onClick: onRefresh, className: "btn-ghost min-h-[36px] min-w-[36px] p-2", children: _jsx(RefreshCw, { size: 14 }) })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Server, { size: 14, className: "text-text-muted" }), _jsx("span", { className: "text-xs text-text-muted", children: "Risk Status" })] }), _jsx(Badge, { variant: blocked ? 'danger' : risk?.status === 'PASS' ? 'success' : 'warning', children: blocked ? 'BLOCKED' : risk?.status ?? 'UNKNOWN' })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Activity, { size: 14, className: "text-text-muted" }), _jsx("span", { className: "text-xs text-text-muted", children: "Exposure" })] }), _jsxs("span", { className: `text-xs font-mono tabular-nums ${exposure > 90 ? 'text-danger' : exposure > 70 ? 'text-warning' : 'text-text-primary'}`, children: [exposure.toFixed(1), "%"] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Database, { size: 14, className: "text-text-muted" }), _jsx("span", { className: "text-xs text-text-muted", children: "Cash Ratio" })] }), _jsxs("span", { className: `text-xs font-mono tabular-nums ${cashRatio < 10 ? 'text-danger' : 'text-text-primary'}`, children: [cashRatio.toFixed(1), "%"] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Clock, { size: 14, className: "text-text-muted" }), _jsx("span", { className: "text-xs text-text-muted", children: "Open Positions" })] }), _jsx("span", { className: "text-xs font-mono tabular-nums text-text-primary", children: openPositions })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(AlertTriangle, { size: 14, className: "text-text-muted" }), _jsx("span", { className: "text-xs text-text-muted", children: "Sell Trades" })] }), _jsx("span", { className: "text-xs font-mono tabular-nums text-text-primary", children: sellTrades })] })] })] }));
}
