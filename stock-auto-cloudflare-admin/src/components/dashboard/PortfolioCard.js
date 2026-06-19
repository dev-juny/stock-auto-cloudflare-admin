import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChevronRight } from 'lucide-react';
import { Card } from '../common/Card';
import { CardSkeleton } from '../common/Skeleton';
import { formatKRW, formatPct } from '../../utils/format';
export function PortfolioCard({ data, loading }) {
    if (loading)
        return _jsx(CardSkeleton, {});
    if (!data || data.holdings.length === 0) {
        return (_jsxs(Card, { children: [_jsx("div", { className: "flex items-center justify-between mb-3", children: _jsx("h2", { className: "text-sm font-semibold text-text-primary", children: "\uACC4\uC88C \uC815\uBCF4" }) }), _jsx("p", { className: "text-xs text-text-muted", children: "\uBCF4\uC720 \uC885\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" })] }));
    }
    const topHoldings = data.holdings.slice(0, 3);
    return (_jsxs(Card, { children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h2", { className: "text-sm font-semibold text-text-primary", children: "\uACC4\uC88C \uC815\uBCF4" }), _jsxs("span", { className: "text-[11px] text-text-muted", children: [data.holdings.length, "\uC885\uBAA9"] })] }), _jsx("div", { className: "space-y-2", children: topHoldings.map((h) => {
                    const pnl = Number(h.evlu_pfls_amt || 0);
                    const pnlPct = Number(h.pfls_rt || 0);
                    const isPositive = pnl >= 0;
                    return (_jsxs("div", { className: "flex items-center gap-3 py-2 border-b border-surface-border last:border-0", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-text-primary truncate", children: h.prdt_name }), _jsx("div", { className: "text-[11px] text-text-muted font-mono tabular-nums", children: formatKRW(h.evlu_amt) })] }), _jsxs("div", { className: "text-right", children: [_jsx("div", { className: `text-sm font-semibold font-mono tabular-nums ${isPositive ? 'text-success' : 'text-danger'}`, children: formatPct(pnlPct) }), _jsxs("div", { className: `text-[11px] font-mono tabular-nums ${isPositive ? 'text-success' : 'text-danger'}`, children: [isPositive ? '+' : '', formatKRW(pnl)] })] })] }, h.pdno));
                }) }), data.holdings.length > 3 && (_jsxs("button", { className: "w-full flex items-center justify-center gap-1 mt-3 text-xs text-text-muted hover:text-text-primary transition-colors min-h-[36px]", children: ["\uBAA8\uB4E0 \uC885\uBAA9 \uBCF4\uAE30 ", _jsx(ChevronRight, { size: 14 })] }))] }));
}
