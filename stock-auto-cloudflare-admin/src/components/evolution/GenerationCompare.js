import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { X, Minus, Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
export function GenerationCompare({ genA, genB, onClose }) {
    const [result, setResult] = useState(null);
    const [genAStrat, setGenAStrat] = useState([]);
    const [genBStrat, setGenBStrat] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        load();
    }, [genA, genB]);
    async function load() {
        setLoading(true);
        try {
            const [cmp, sa, sb] = await Promise.all([
                api.get(`/api/evolution/generations/compare?gen_a=${genA}&gen_b=${genB}`),
                api.get(`/api/evolution/generations/${genA}/strategies`),
                api.get(`/api/evolution/generations/${genB}/strategies`),
            ]);
            setResult(cmp);
            setGenAStrat(sa);
            setGenBStrat(sb);
        }
        catch { }
        setLoading(false);
    }
    function Delta({ val, suffix = '' }) {
        const isPos = val > 0;
        const isZero = val === 0;
        return (_jsxs("span", { className: `inline-flex items-center gap-0.5 font-medium ${isZero ? 'text-text-muted' : isPos ? 'text-green-400' : 'text-red-400'}`, children: [isZero ? _jsx(Minus, { size: 12 }) : isPos ? _jsx(ArrowUpRight, { size: 12 }) : _jsx(ArrowDownRight, { size: 12 }), isPos ? '+' : '', val.toFixed(2), suffix] }));
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40", onClick: onClose, children: _jsxs("div", { className: "bg-surface-card w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center justify-between p-4 border-b border-surface-border", children: [_jsxs("h3", { className: "text-sm font-bold text-text", children: ["Gen ", genA, " ", _jsx("span", { className: "text-text-muted mx-1", children: "vs" }), " Gen ", genB] }), _jsx("button", { onClick: onClose, className: "p-1 text-text-muted hover:text-text transition-colors", children: _jsx(X, { size: 16 }) })] }), loading ? (_jsx("div", { className: "p-8 text-center text-xs text-text-muted", children: "Loading..." })) : !result ? (_jsx("div", { className: "p-8 text-center text-xs text-text-muted", children: "Failed to load comparison" })) : (_jsxs("div", { className: "overflow-y-auto flex-1 p-4 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "bg-surface rounded-xl p-4", children: [_jsxs("div", { className: "text-[11px] font-semibold text-text-muted mb-3", children: ["Gen ", genA] }), _jsx("div", { className: "space-y-2", children: [
                                                { label: 'Strategies', value: result.gen_a.count },
                                                { label: 'Avg Return', value: `${result.gen_a.avg_return >= 0 ? '+' : ''}${result.gen_a.avg_return.toFixed(2)}%` },
                                                { label: 'Avg Win Rate', value: `${result.gen_a.avg_winrate.toFixed(1)}%` },
                                                { label: 'Avg Fitness', value: result.gen_a.avg_fitness.toFixed(2) },
                                                { label: 'Avg MDD', value: `${result.gen_a.avg_mdd.toFixed(2)}%` },
                                            ].map(({ label, value }) => (_jsxs("div", { className: "flex justify-between text-xs", children: [_jsx("span", { className: "text-text-muted", children: label }), _jsx("span", { className: "text-text font-medium", children: value })] }, label))) })] }), _jsxs("div", { className: "bg-surface rounded-xl p-4", children: [_jsxs("div", { className: "text-[11px] font-semibold text-text-muted mb-3", children: ["Gen ", genB] }), _jsx("div", { className: "space-y-2", children: [
                                                { label: 'Strategies', value: result.gen_b.count },
                                                { label: 'Avg Return', value: `${result.gen_b.avg_return >= 0 ? '+' : ''}${result.gen_b.avg_return.toFixed(2)}%` },
                                                { label: 'Avg Win Rate', value: `${result.gen_b.avg_winrate.toFixed(1)}%` },
                                                { label: 'Avg Fitness', value: result.gen_b.avg_fitness.toFixed(2) },
                                                { label: 'Avg MDD', value: `${result.gen_b.avg_mdd.toFixed(2)}%` },
                                            ].map(({ label, value }) => (_jsxs("div", { className: "flex justify-between text-xs", children: [_jsx("span", { className: "text-text-muted", children: label }), _jsx("span", { className: "text-text font-medium", children: value })] }, label))) })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "bg-surface rounded-xl p-4", children: [_jsxs("div", { className: "flex items-center gap-1 text-xs text-green-400 font-medium mb-2", children: [_jsx(Plus, { size: 14 }), " New Entries: ", result.new_entries] }), _jsxs("div", { className: "flex items-center gap-1 text-xs text-red-400 font-medium", children: [_jsx(Minus, { size: 14 }), " Removed: ", result.removed] })] }), _jsxs("div", { className: "bg-surface rounded-xl p-4", children: [_jsx("div", { className: "text-[11px] font-semibold text-text-muted mb-2", children: "Performance Delta" }), _jsxs("div", { className: "space-y-1 text-xs", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-text-muted", children: "Return" }), _jsx(Delta, { val: result.gen_b.avg_return - result.gen_a.avg_return, suffix: "%" })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-text-muted", children: "Win Rate" }), _jsx(Delta, { val: result.gen_b.avg_winrate - result.gen_a.avg_winrate, suffix: "%" })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-text-muted", children: "Fitness" }), _jsx(Delta, { val: result.gen_b.avg_fitness - result.gen_a.avg_fitness })] })] })] })] }), result.changed.length > 0 && (_jsxs("div", { className: "bg-surface rounded-xl p-4", children: [_jsx("div", { className: "text-[11px] font-semibold text-text-muted mb-3", children: "Strategy Changes" }), _jsx("div", { className: "space-y-2 max-h-40 overflow-y-auto", children: result.changed.map(c => (_jsxs("div", { className: "flex items-center justify-between text-xs bg-surface-card rounded-lg px-3 py-2", children: [_jsx("span", { className: "text-text font-medium truncate max-w-[120px]", children: c.name }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("span", { children: [_jsx("span", { className: "text-text-muted mr-1", children: "R:" }), _jsx(Delta, { val: c.return_change, suffix: "%" })] }), _jsxs("span", { children: [_jsx("span", { className: "text-text-muted mr-1", children: "WR:" }), _jsx(Delta, { val: c.winrate_change, suffix: "%" })] }), _jsxs("span", { children: [_jsx("span", { className: "text-text-muted mr-1", children: "F:" }), _jsx(Delta, { val: c.fitness_change })] })] })] }, c.strategy_id))) })] }))] }))] }) }));
}
