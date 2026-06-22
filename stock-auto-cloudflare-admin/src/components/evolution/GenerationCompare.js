import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { X, Minus, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Plus } from 'lucide-react';
export function GenerationCompare({ genA, genB, onClose }) {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        load();
    }, [genA, genB]);
    async function load() {
        setLoading(true);
        try {
            const data = await api.post('/api/evolution/history/compare', {
                generationIds: [genA, genB],
            });
            setResult(data);
        }
        catch (e) {
            console.error('Compare failed', e);
        }
        setLoading(false);
    }
    function Delta({ val, suffix = '' }) {
        const isPos = val > 0;
        const isZero = val === 0;
        return (_jsxs("span", { className: `inline-flex items-center gap-0.5 font-medium ${isZero ? 'text-text-muted' : isPos ? 'text-green-400' : 'text-red-400'}`, children: [isZero ? _jsx(Minus, { size: 12 }) : isPos ? _jsx(ArrowUpRight, { size: 12 }) : _jsx(ArrowDownRight, { size: 12 }), isPos ? '+' : '', val.toFixed(2), suffix] }));
    }
    const universe = result?.universe;
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40", onClick: onClose, children: _jsxs("div", { className: "bg-surface-card w-full sm:max-w-4xl sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center justify-between p-4 border-b border-surface-border", children: [_jsxs("h3", { className: "text-sm font-bold text-text", children: ["Gen ", genA, " ", _jsx("span", { className: "text-text-muted mx-1", children: "vs" }), " Gen ", genB] }), _jsx("button", { onClick: onClose, className: "p-1 text-text-muted hover:text-text transition-colors", children: _jsx(X, { size: 16 }) })] }), loading ? (_jsx("div", { className: "p-8 text-center text-xs text-text-muted", children: "Loading..." })) : !result ? (_jsx("div", { className: "p-8 text-center text-xs text-text-muted", children: "Failed to load comparison" })) : (_jsxs("div", { className: "overflow-y-auto flex-1 p-4 space-y-4", children: [_jsx("div", { className: "grid grid-cols-2 gap-4", children: [result.gen_a, result.gen_b].map(gen => (_jsxs("div", { className: "bg-surface rounded-xl p-4", children: [_jsxs("div", { className: "text-[11px] font-semibold text-text-muted mb-3", children: ["Gen ", gen.generation] }), _jsx("div", { className: "space-y-2", children: [
                                            { label: 'Fitness', value: gen.avg_fitness.toFixed(2) },
                                            { label: 'Return', value: `${gen.avg_return >= 0 ? '+' : ''}${gen.avg_return.toFixed(2)}%` },
                                            { label: 'Win Rate', value: `${gen.avg_winrate.toFixed(1)}%` },
                                            { label: 'MDD', value: `${gen.avg_mdd.toFixed(2)}%` },
                                            { label: 'Strategies', value: String(gen.count) },
                                        ].map(({ label, value }) => (_jsxs("div", { className: "flex justify-between text-xs", children: [_jsx("span", { className: "text-text-muted", children: label }), _jsx("span", { className: "text-text font-medium", children: value })] }, label))) })] }, gen.generation))) }), _jsxs("div", { className: "bg-surface rounded-xl p-4", children: [_jsxs("div", { className: "flex items-center gap-1.5 mb-3", children: [_jsx(ArrowLeftRight, { size: 12, className: "text-primary" }), _jsx("span", { className: "text-[10px] font-semibold text-text-muted uppercase tracking-wider", children: "Performance Delta" })] }), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { className: "bg-surface-card rounded-lg p-3", children: [_jsx("div", { className: "text-[10px] text-text-muted mb-1", children: "Return" }), _jsx(Delta, { val: result.gen_b.avg_return - result.gen_a.avg_return, suffix: "%" })] }), _jsxs("div", { className: "bg-surface-card rounded-lg p-3", children: [_jsx("div", { className: "text-[10px] text-text-muted mb-1", children: "Win Rate" }), _jsx(Delta, { val: result.gen_b.avg_winrate - result.gen_a.avg_winrate, suffix: "%" })] }), _jsxs("div", { className: "bg-surface-card rounded-lg p-3", children: [_jsx("div", { className: "text-[10px] text-text-muted mb-1", children: "Fitness" }), _jsx(Delta, { val: result.gen_b.avg_fitness - result.gen_a.avg_fitness })] })] })] }), _jsxs("div", { className: "bg-surface rounded-xl p-4", children: [_jsxs("div", { className: "flex items-center gap-1.5 mb-3", children: [_jsx(ArrowLeftRight, { size: 12, className: "text-primary" }), _jsx("span", { className: "text-[10px] font-semibold text-text-muted uppercase tracking-wider", children: "Evaluation Universe Delta" })] }), _jsxs("div", { className: "grid grid-cols-3 gap-3 mb-4", children: [_jsxs("div", { className: "bg-surface-card rounded-lg p-3", children: [_jsxs("div", { className: "text-[10px] text-text-muted mb-1", children: ["Gen ", genA] }), _jsx("div", { className: "text-xs font-bold text-text", children: universe?.gen_a_count ?? 0 })] }), _jsxs("div", { className: "bg-surface-card rounded-lg p-3", children: [_jsx("div", { className: "text-[10px] text-text-muted mb-1", children: "Common" }), _jsx("div", { className: "text-xs font-bold text-primary", children: universe?.common_count ?? 0 })] }), _jsxs("div", { className: "bg-surface-card rounded-lg p-3", children: [_jsxs("div", { className: "text-[10px] text-text-muted mb-1", children: ["Gen ", genB] }), _jsx("div", { className: "text-xs font-bold text-text", children: universe?.gen_b_count ?? 0 })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsx(UniverseList, { title: `Only in Gen ${genB}`, icon: _jsx(Plus, { size: 14 }), color: "text-green-400", stocks: universe?.added || [] }), _jsx(UniverseList, { title: `Only in Gen ${genA}`, icon: _jsx(Minus, { size: 14 }), color: "text-red-400", stocks: universe?.removed || [] })] })] })] }))] }) }));
}
function UniverseList({ title, icon, color, stocks, }) {
    return (_jsxs("div", { children: [_jsxs("div", { className: `flex items-center gap-1 text-xs font-medium mb-3 ${color}`, children: [icon, " ", title, " (", stocks.length, ")"] }), stocks.length === 0 ? (_jsx("div", { className: "p-4 text-center text-xs text-text-muted bg-surface-card rounded-lg", children: "No differences" })) : (_jsx("div", { className: "space-y-1.5 max-h-52 overflow-y-auto", children: stocks.map(stock => (_jsxs("div", { className: "flex items-center justify-between text-xs bg-surface-card rounded-lg px-3 py-2", children: [_jsxs("div", { children: [_jsx("span", { className: "text-text font-medium", children: stock.name }), _jsx("span", { className: "text-text-muted ml-1.5 font-mono", children: stock.ticker })] }), _jsx("span", { className: "text-text-muted", children: stock.market || '-' })] }, stock.ticker))) }))] }));
}
