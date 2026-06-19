import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { X, TrendingUp, Percent, Activity, Hash } from 'lucide-react';
export function GenerationDetail({ generation, onClose, onCompare }) {
    const [strategies, setStrategies] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        load();
    }, [generation]);
    async function load() {
        setLoading(true);
        try {
            const data = await api.get(`/api/evolution/generations/${generation}/strategies`);
            setStrategies(data || []);
        }
        catch { }
        setLoading(false);
    }
    const tested = strategies.filter(s => s.total_trades > 0);
    const avgRet = tested.length ? tested.reduce((a, s) => a + s.total_return, 0) / tested.length : 0;
    const avgWr = tested.length ? tested.reduce((a, s) => a + s.win_rate, 0) / tested.length : 0;
    const avgFitness = tested.length ? tested.reduce((a, s) => a + s.fitness_score, 0) / tested.length : 0;
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40", onClick: onClose, children: _jsxs("div", { className: "bg-surface-card w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center justify-between p-4 border-b border-surface-border", children: [_jsxs("h3", { className: "text-sm font-bold text-text", children: ["Generation ", generation, " \u2014 Strategies"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => onCompare(generation), className: "text-[11px] px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors", children: "Compare" }), _jsx("button", { onClick: onClose, className: "p-1 text-text-muted hover:text-text transition-colors", children: _jsx(X, { size: 16 }) })] })] }), loading ? (_jsx("div", { className: "p-8 text-center text-xs text-text-muted", children: "Loading..." })) : strategies.length === 0 ? (_jsx("div", { className: "p-8 text-center text-xs text-text-muted", children: "No strategies in this generation" })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "grid grid-cols-4 gap-3 p-4 bg-surface/50", children: [
                                { label: 'Avg Return', value: avgRet, icon: TrendingUp, format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, color: 'text-green-400' },
                                { label: 'Avg Win Rate', value: avgWr, icon: Percent, format: (v) => `${v.toFixed(1)}%`, color: 'text-blue-400' },
                                { label: 'Avg Fitness', value: avgFitness, icon: Activity, format: (v) => v.toFixed(2), color: 'text-amber-400' },
                                { label: 'Count', value: strategies.length, icon: Hash, format: (v) => String(v), color: 'text-text-muted' },
                            ].map(m => {
                                const Icon = m.icon;
                                return (_jsxs("div", { className: "bg-surface-card rounded-xl p-3", children: [_jsxs("div", { className: "flex items-center gap-1 text-[10px] text-text-muted mb-1", children: [_jsx(Icon, { size: 10 }), " ", m.label] }), _jsx("div", { className: `text-sm font-bold ${m.color}`, children: m.format(m.value) })] }, m.label));
                            }) }), _jsx("div", { className: "overflow-y-auto flex-1", children: _jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { className: "sticky top-0 bg-surface-card", children: _jsxs("tr", { className: "text-text-muted border-b border-surface-border", children: [_jsx("th", { className: "text-left px-4 py-2 font-medium", children: "Name" }), _jsx("th", { className: "text-right px-2 py-2 font-medium", children: "Fitness" }), _jsx("th", { className: "text-right px-2 py-2 font-medium", children: "Return" }), _jsx("th", { className: "text-right px-2 py-2 font-medium", children: "Win Rate" }), _jsx("th", { className: "text-right px-2 py-2 font-medium", children: "MDD" }), _jsx("th", { className: "text-right px-2 py-2 font-medium", children: "Trades" })] }) }), _jsx("tbody", { className: "divide-y divide-surface-border", children: strategies.map(s => (_jsxs("tr", { className: "hover:bg-surface/50 transition-colors", children: [_jsx("td", { className: "px-4 py-2 text-text font-medium", children: s.name }), _jsx("td", { className: "px-2 py-2 text-right text-amber-400", children: s.fitness_score.toFixed(2) }), _jsxs("td", { className: `px-2 py-2 text-right ${s.total_return >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [s.total_return >= 0 ? '+' : '', s.total_return.toFixed(2), "%"] }), _jsxs("td", { className: "px-2 py-2 text-right text-blue-400", children: [s.win_rate.toFixed(1), "%"] }), _jsxs("td", { className: "px-2 py-2 text-right text-red-400", children: [s.max_drawdown.toFixed(2), "%"] }), _jsx("td", { className: "px-2 py-2 text-right text-text-muted", children: s.total_trades })] }, s.id))) })] }) })] }))] }) }));
}
