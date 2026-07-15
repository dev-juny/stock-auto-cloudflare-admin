import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { CardSkeleton } from '../common/Skeleton';
import { formatKRW, formatPct, formatStockDisplay } from '../../utils/format';
import { api } from '../../utils/api';
export function PositionsCard() {
    const [positions, setPositions] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        api.get('/api/positions')
            .then((list) => setPositions(Array.isArray(list) ? list : []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);
    if (loading)
        return _jsx(CardSkeleton, {});
    if (positions.length === 0) {
        return (_jsxs(Card, { children: [_jsx("h2", { className: "text-sm font-semibold text-text-primary mb-2", children: "\uBCF4\uC720 \uD3EC\uC9C0\uC158" }), _jsx("p", { className: "text-xs text-text-muted", children: "\uD65C\uC131 \uD3EC\uC9C0\uC158\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" })] }));
    }
    return (_jsxs(Card, { children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h2", { className: "text-sm font-semibold text-text-primary", children: "\uBCF4\uC720 \uD3EC\uC9C0\uC158" }), _jsxs("span", { className: "text-[11px] text-text-muted", children: [positions.length, "\uAC1C"] })] }), _jsx("div", { className: "space-y-1", children: positions.map((p) => {
                    const isPositive = p.pnl_pct >= 0;
                    return (_jsxs("div", { className: "flex items-center gap-3 py-2.5 px-3 rounded-xl bg-surface border border-surface-border", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-text-primary truncate", children: formatStockDisplay(p.name, p.ticker) }), _jsxs("div", { className: "text-[11px] text-text-muted font-mono tabular-nums", children: [p.quantity, "\uC8FC @ ", formatKRW(p.entry_price)] })] }), _jsxs("div", { className: "text-right", children: [_jsx("div", { className: `text-sm font-semibold font-mono tabular-nums ${isPositive ? 'text-success' : 'text-danger'}`, children: formatPct(p.pnl_pct) }), _jsxs("div", { className: `text-[11px] font-mono tabular-nums ${isPositive ? 'text-success' : 'text-danger'}`, children: [isPositive ? '+' : '', formatKRW(p.pnl_amount)] })] })] }, p.ticker));
                }) })] }));
}
