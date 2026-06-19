import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Search, ShieldCheck, TrendingUp, TrendingDown, Activity, ChevronRight, Zap } from 'lucide-react';
export function StrategyPool({ strategies, onSelect }) {
    const [search, setSearch] = useState('');
    const filtered = search
        ? strategies.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
        : strategies;
    const entryIcon = (type) => {
        switch (type) {
            case 'momentum': return _jsx(Zap, { size: 14, className: "text-blue-400" });
            case 'breakout': return _jsx(TrendingUp, { size: 14, className: "text-green-400" });
            case 'pullback': return _jsx(TrendingDown, { size: 14, className: "text-orange-400" });
            default: return _jsx(Activity, { size: 14, className: "text-purple-400" });
        }
    };
    return (_jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsx("div", { className: "p-3 border-b border-surface-border", children: _jsxs("div", { className: "relative", children: [_jsx(Search, { size: 14, className: "absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" }), _jsx("input", { type: "text", placeholder: "Search strategies...", value: search, onChange: (e) => setSearch(e.target.value), className: "w-full pl-8 pr-3 py-2 bg-surface rounded-lg text-sm text-text placeholder:text-text-muted border border-surface-border focus:outline-none focus:border-primary" })] }) }), _jsxs("div", { className: "divide-y divide-surface-border max-h-[60vh] overflow-y-auto", children: [filtered.length === 0 && (_jsx("div", { className: "p-6 text-center text-sm text-text-muted", children: "No strategies found" })), filtered.map((s) => (_jsxs("button", { onClick: () => onSelect(s), className: "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface/50 transition-colors", children: [s.is_elite && _jsx(ShieldCheck, { size: 16, className: "text-amber-400 shrink-0" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [entryIcon(s.params?.entry_type), _jsx("span", { className: "text-sm font-medium text-text truncate", children: s.name }), s.is_elite && (_jsx("span", { className: "text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium shrink-0", children: "ELITE" }))] }), _jsxs("div", { className: "flex items-center gap-2 mt-0.5", children: [_jsxs("span", { className: "text-[10px] text-text-muted", children: ["G", s.generation] }), _jsxs("span", { className: "text-[10px] text-text-muted", children: ["v", s.version] }), s.total_trades > 0 && (_jsxs(_Fragment, { children: [_jsxs("span", { className: `text-[10px] font-medium ${s.total_return >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [s.total_return >= 0 ? '+' : '', s.total_return.toFixed(2), "%"] }), _jsxs("span", { className: `text-[10px] font-medium ${s.win_rate >= 50 ? 'text-green-400' : 'text-red-400'}`, children: [s.win_rate.toFixed(1), "%"] })] })), _jsx("span", { className: "text-[10px] text-text-muted", children: s.tags?.slice(0, 2).join(', ') })] })] }), _jsx(ChevronRight, { size: 14, className: "text-text-muted shrink-0" })] }, s.id)))] })] }));
}
