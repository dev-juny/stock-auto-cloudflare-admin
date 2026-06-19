import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useTrades } from '../../hooks/useTrades';
import { Card } from '../common/Card';
import { CardSkeleton } from '../common/Skeleton';
import { TradeDrawer } from './TradeDrawer';
import { formatPct } from '../../utils/format';
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
export function TradeHistory() {
    const { trades, loading } = useTrades();
    const [drawerOpen, setDrawerOpen] = useState(false);
    if (loading)
        return _jsx(CardSkeleton, {});
    const recent = trades.slice(0, 5);
    const totalWin = trades.filter((t) => t.pnl && t.pnl > 0).length;
    const winRate = trades.length > 0 ? ((totalWin / trades.length) * 100).toFixed(1) : '0.0';
    return (_jsxs(_Fragment, { children: [_jsxs(Card, { children: [_jsxs("button", { onClick: () => setDrawerOpen(true), className: "w-full flex items-center justify-between mb-3 min-h-[36px]", children: [_jsx("h2", { className: "text-sm font-semibold text-text-primary", children: "\uAC70\uB798 \uB0B4\uC5ED" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "text-[11px] text-text-muted", children: [trades.length, "\uAC74 \u00B7 \uC2B9\uB960 ", winRate, "%"] }), trades.length > 5 && _jsx(ExternalLink, { size: 13, className: "text-text-muted" })] })] }), recent.length === 0 ? (_jsx("p", { className: "text-xs text-text-muted py-4 text-center", children: "\uAC70\uB798 \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" })) : (_jsx("div", { className: "space-y-0.5", children: recent.map((t, i) => {
                            const isBuy = t.action === 'BUY';
                            const pnl = t.pnl ?? 0;
                            const isPositive = pnl >= 0;
                            const pnlPct = t.pnl_pct ?? 0;
                            return (_jsxs("button", { onClick: () => setDrawerOpen(true), className: "w-full flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-surface-hover transition-colors min-h-[44px]", children: [_jsx("div", { className: `w-1 h-8 rounded-full flex-shrink-0 ${isBuy ? 'bg-primary' : 'bg-danger'}` }), _jsxs("div", { className: "flex-1 min-w-0 text-left", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm font-medium text-text-primary truncate", children: t.name || t.ticker || '거래' }), _jsx("span", { className: `text-[10px] font-medium px-1.5 py-0.25 rounded ${isBuy ? 'bg-primary/15 text-primary' : 'bg-danger/15 text-danger'}`, children: isBuy ? 'B' : 'S' })] }), _jsx("div", { className: "text-[11px] text-text-muted font-mono tabular-nums", children: t.reason || '-' })] }), _jsx("div", { className: "text-right", children: _jsxs("div", { className: `flex items-center gap-1 text-sm font-semibold font-mono tabular-nums ${isPositive ? 'text-success' : 'text-danger'}`, children: [isPositive ? _jsx(TrendingUp, { size: 12 }) : _jsx(TrendingDown, { size: 12 }), formatPct(pnlPct)] }) })] }, t.id || i));
                        }) })), trades.length > 5 && (_jsxs("button", { onClick: () => setDrawerOpen(true), className: "w-full text-center text-xs text-text-muted hover:text-text-primary mt-2 min-h-[36px] transition-colors", children: ["\uC804\uCCB4 ", trades.length, "\uAC74 \uBCF4\uAE30"] }))] }), _jsx(TradeDrawer, { trades: trades, open: drawerOpen, onClose: () => setDrawerOpen(false) })] }));
}
