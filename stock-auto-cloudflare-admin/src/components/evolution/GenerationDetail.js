import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../utils/api';
import { X, TrendingUp, Percent, Activity, Target } from 'lucide-react';
function ModalContent({ generation, onClose }) {
    const [tab, setTab] = useState('universe');
    const [strategies, setStrategies] = useState([]);
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        load();
    }, [generation]);
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);
    async function load() {
        setLoading(true);
        try {
            const [stratData, histData] = await Promise.all([
                api.get(`/api/evolution/generations/${generation}/strategies`),
                api.get(`/api/evolution/history/${generation}`),
            ]);
            setStrategies(stratData || []);
            setHistory(histData);
        }
        catch { }
        setLoading(false);
    }
    const tested = strategies.filter(s => s.total_trades > 0);
    const avgRet = tested.length ? tested.reduce((a, s) => a + s.total_return, 0) / tested.length : 0;
    const avgWr = tested.length ? tested.reduce((a, s) => a + s.win_rate, 0) / tested.length : 0;
    const avgFitness = tested.length ? tested.reduce((a, s) => a + s.fitness_score, 0) / tested.length : 0;
    const universe = history?.evaluation_universe || [];
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40", onClick: onClose, children: _jsxs("div", { className: "bg-surface-card w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center justify-between p-4 border-b border-surface-border", children: [_jsxs("div", { children: [_jsxs("h3", { className: "text-sm font-bold text-text", children: ["Generation ", generation] }), _jsxs("span", { className: "text-[10px] text-text-muted", children: [universe.length, " evaluation stocks | ", strategies.length, " strategies"] })] }), _jsx("button", { onClick: onClose, className: "p-1 text-text-muted hover:text-text transition-colors", children: _jsx(X, { size: 16 }) })] }), loading ? (_jsx("div", { className: "p-8 text-center text-xs text-text-muted", children: "Loading..." })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "grid grid-cols-4 gap-2 p-3 bg-surface/50", children: [
                                { label: 'Return', value: `${avgRet >= 0 ? '+' : ''}${avgRet.toFixed(2)}%`, icon: TrendingUp, color: avgRet >= 0 ? 'text-green-400' : 'text-red-400' },
                                { label: 'Win Rate', value: `${avgWr.toFixed(1)}%`, icon: Percent, color: 'text-blue-400' },
                                { label: 'Fitness', value: avgFitness.toFixed(2), icon: Activity, color: 'text-amber-400' },
                                { label: 'Universe', value: String(universe.length), icon: Target, color: 'text-primary' },
                            ].map(m => {
                                const Icon = m.icon;
                                return (_jsxs("div", { className: "bg-surface-card rounded-xl p-2.5", children: [_jsxs("div", { className: "flex items-center gap-1 text-[9px] text-text-muted mb-0.5", children: [_jsx(Icon, { size: 9 }), " ", m.label] }), _jsx("div", { className: `text-xs font-bold ${m.color}`, children: m.value })] }, m.label));
                            }) }), _jsx("div", { className: "flex gap-2 px-4 border-b border-surface-border", children: [
                                { id: 'universe', label: 'Evaluation Universe', count: universe.length },
                                { id: 'strategies', label: 'Strategies', count: strategies.length },
                            ].map(t => {
                                const isActive = tab === t.id;
                                return (_jsxs("button", { onClick: () => setTab(t.id), className: `relative h-9 text-xs font-medium whitespace-nowrap transition-colors px-1 ${isActive
                                        ? 'text-text'
                                        : 'text-text-muted hover:text-text'}`, children: [t.label, _jsx("span", { className: `ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary/15 text-primary' : 'bg-surface text-text-muted'}`, children: t.count }), isActive && (_jsx("span", { className: "absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" }))] }, t.id));
                            }) }), _jsxs("div", { className: "overflow-y-auto flex-1", children: [tab === 'universe' && (_jsx("div", { className: "p-3", children: _jsxs("div", { className: "bg-surface rounded-xl overflow-hidden", children: [_jsxs("div", { className: "px-3 py-2 border-b border-surface-border flex items-center justify-between", children: [_jsx("span", { className: "text-[10px] font-semibold text-text-muted uppercase tracking-wider", children: "Evaluation Universe" }), _jsx("span", { className: "text-[10px] text-text-muted", children: "Shared by all strategies in this generation" })] }), universe.length === 0 ? (_jsx("div", { className: "p-6 text-center text-xs text-text-muted", children: "No evaluation universe recorded" })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-[11px]", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-text-muted border-b border-surface-border", children: [_jsx("th", { className: "text-right px-3 py-1.5 font-medium", children: "#" }), _jsx("th", { className: "text-left px-3 py-1.5 font-medium", children: "Stock" }), _jsx("th", { className: "text-left px-2 py-1.5 font-medium", children: "Market" }), _jsx("th", { className: "text-left px-2 py-1.5 font-medium", children: "Source" })] }) }), _jsx("tbody", { className: "divide-y divide-surface-border", children: universe.map(stock => (_jsxs("tr", { className: "hover:bg-surface/50 transition-colors", children: [_jsx("td", { className: "px-3 py-1.5 text-right text-text-muted font-mono", children: stock.sample_order }), _jsxs("td", { className: "px-3 py-1.5", children: [_jsx("div", { className: "text-text font-medium", children: stock.name }), _jsx("div", { className: "text-[9px] text-text-muted font-mono", children: stock.ticker })] }), _jsx("td", { className: "px-2 py-1.5 text-text-muted", children: stock.market || '-' }), _jsx("td", { className: "px-2 py-1.5 text-text-muted", children: stock.selection_source })] }, stock.ticker))) })] }) }))] }) })), tab === 'strategies' && (_jsx("div", { children: strategies.length === 0 ? (_jsx("div", { className: "p-6 text-center text-xs text-text-muted", children: "No strategies" })) : (_jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { className: "sticky top-0 bg-surface-card", children: _jsxs("tr", { className: "text-text-muted border-b border-surface-border", children: [_jsx("th", { className: "text-left px-4 py-2 font-medium", children: "Name" }), _jsx("th", { className: "text-right px-2 py-2 font-medium", children: "Fitness" }), _jsx("th", { className: "text-right px-2 py-2 font-medium", children: "Return" }), _jsx("th", { className: "text-right px-2 py-2 font-medium", children: "Win Rate" }), _jsx("th", { className: "text-right px-2 py-2 font-medium", children: "MDD" }), _jsx("th", { className: "text-right px-2 py-2 font-medium", children: "Trades" })] }) }), _jsx("tbody", { className: "divide-y divide-surface-border", children: strategies.map(s => (_jsxs("tr", { className: "hover:bg-surface/50 transition-colors", children: [_jsx("td", { className: "px-4 py-2 text-text font-medium", children: s.name }), _jsx("td", { className: "px-2 py-2 text-right text-amber-400", children: s.fitness_score.toFixed(2) }), _jsxs("td", { className: `px-2 py-2 text-right ${s.total_return >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [s.total_return >= 0 ? '+' : '', s.total_return.toFixed(2), "%"] }), _jsxs("td", { className: "px-2 py-2 text-right text-blue-400", children: [s.win_rate.toFixed(1), "%"] }), _jsxs("td", { className: "px-2 py-2 text-right text-red-400", children: [s.max_drawdown.toFixed(2), "%"] }), _jsx("td", { className: "px-2 py-2 text-right text-text-muted", children: s.total_trades })] }, s.id))) })] })) }))] })] }))] }) }));
}
export function GenerationDetail({ generation, onClose }) {
    return createPortal(_jsx(ModalContent, { generation: generation, onClose: onClose }), document.body);
}
