import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Wallet, TrendingUp, PieChart, BarChart3 } from 'lucide-react';
export default function PortfolioPage() {
    const [data, setData] = useState(null);
    const [perf, setPerf] = useState([]);
    useEffect(() => {
        async function load() {
            try {
                const [p, pf] = await Promise.all([
                    api.get('/api/portfolio'),
                    api.get('/api/portfolio/performance'),
                ]);
                setData(p);
                setPerf(pf.snapshots || []);
            }
            catch { }
        }
        load();
        const interval = setInterval(load, 30000);
        return () => clearInterval(interval);
    }, []);
    if (!data) {
        return _jsx("div", { className: "flex items-center justify-center h-48 text-xs text-text-muted", children: "Loading portfolio..." });
    }
    const latestPnl = data.pnl_pct;
    const maxVal = Math.max(...perf.map(s => s.total_value), 1);
    const minVal = Math.min(...perf.map(s => s.total_value), 0);
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(SummaryCard, { icon: Wallet, label: "Total Value", value: `₩${data.total_value.toLocaleString()}`, color: "text-text" }), _jsx(SummaryCard, { icon: TrendingUp, label: "P&L %", value: `${latestPnl >= 0 ? '+' : ''}${latestPnl.toFixed(2)}%`, color: latestPnl >= 0 ? 'text-green-400' : 'text-red-400' }), _jsx(SummaryCard, { icon: PieChart, label: "Invested", value: `₩${data.invested.toLocaleString()}`, color: "text-blue-400" }), _jsx(SummaryCard, { icon: BarChart3, label: "Positions", value: data.positions_count.toString(), color: "text-amber-400" })] }), perf.length > 1 && (_jsxs("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: [_jsx("h3", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider mb-3", children: "Portfolio Value" }), _jsx("div", { className: "flex items-end gap-0.5 h-20", children: perf.slice(0, 60).reverse().map((s, i) => {
                            const h = ((s.total_value - minVal) / (maxVal - minVal || 1)) * 100;
                            return (_jsx("div", { className: "flex-1 rounded-t-sm bg-primary/60 hover:bg-primary/80 transition-colors", style: { height: `${Math.max(h, 2)}%` }, title: `${s.date_kst || s.date}: ₩${s.total_value.toLocaleString()}` }, i));
                        }) })] })), _jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsx("div", { className: "p-3 border-b border-surface-border", children: _jsx("h3", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Holdings" }) }), data.holdings.length === 0 ? (_jsx("div", { className: "p-6 text-center text-xs text-text-muted", children: "No active holdings" })) : (_jsx("div", { className: "divide-y divide-surface-border", children: data.holdings.map((h, i) => (_jsxs("div", { className: "px-4 py-3 flex items-center gap-3", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-sm font-medium text-text truncate", children: h.name || h.ticker }), _jsx("span", { className: "text-[10px] text-text-muted", children: h.ticker })] }), _jsxs("div", { className: "flex items-center gap-2 mt-0.5 text-[10px] text-text-muted", children: [_jsxs("span", { children: ["Entry: \u20A9", h.entry_price?.toLocaleString()] }), _jsxs("span", { children: ["Qty: ", h.quantity] }), h.allocation > 0 && _jsxs("span", { children: ["Alloc: ", h.allocation.toFixed(1), "%"] })] })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: `text-sm font-bold ${h.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [h.pnl_pct >= 0 ? '+' : '', h.pnl_pct?.toFixed(2), "%"] }), _jsxs("div", { className: "text-[10px] text-text-muted", children: ["\u20A9", Math.abs(h.pnl_amt || 0).toLocaleString()] })] })] }, i))) }))] })] }));
}
function SummaryCard({ icon: Icon, label, value, color }) {
    return (_jsxs("div", { className: "bg-surface-card rounded-2xl p-4 border border-surface-border", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-text-muted mb-1.5", children: [_jsx(Icon, { size: 14 }), _jsx("span", { className: "text-[10px] font-medium", children: label })] }), _jsx("div", { className: `text-lg font-bold ${color}`, children: value })] }));
}
