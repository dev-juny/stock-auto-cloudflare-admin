import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { GitCommit, GitBranch, BarChart3, ArrowUpDown, TrendingUp, Percent, TrendingDown } from 'lucide-react';
export function EvolutionTimeline({ generations, onGenClick, compareMode, compareSelections, onToggleCompare }) {
    if (!generations || generations.length === 0) {
        return (_jsx("div", { className: "bg-surface-card rounded-2xl p-6 border border-surface-border", children: _jsx("p", { className: "text-xs text-text-muted text-center", children: "No generations recorded yet" }) }));
    }
    const sorted = [...generations].reverse();
    return (_jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsx("div", { className: "p-3 border-b border-surface-border", children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(GitCommit, { size: 14, className: "text-primary" }), _jsx("span", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Generation History" })] }) }), _jsx("div", { className: "divide-y divide-surface-border", children: sorted.map((g, idx) => {
                    const isSelected = compareSelections?.has(g.generation);
                    return (_jsxs("div", { className: `px-4 py-3 cursor-pointer hover:bg-surface/50 transition-colors ${compareMode && isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`, onClick: () => {
                            if (compareMode) {
                                onToggleCompare?.(g.generation);
                            }
                            else {
                                onGenClick?.(g.generation);
                            }
                        }, children: [_jsxs("div", { className: "flex items-center gap-2 mb-1.5", children: [compareMode ? (_jsx("div", { className: `flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${isSelected ? 'border-primary bg-primary text-white' : 'border-text-muted'}`, children: isSelected && _jsx("span", { className: "text-[10px] font-bold", children: "\u2713" }) })) : (_jsx("div", { className: "flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold", children: g.generation })), _jsxs("div", { className: "flex items-center gap-2 text-[10px] text-text-muted", children: [_jsxs("span", { children: ["Population: ", g.population_size] }), _jsxs("span", { children: ["Elite: ", g.elite_count] })] }), _jsx("span", { className: "text-[10px] text-text-muted ml-auto", children: g.created_at_kst || g.created_at })] }), _jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2", children: [_jsx(Metric, { icon: BarChart3, label: "Avg Fitness", value: g.avg_fitness.toFixed(2), color: "text-green-400" }), _jsx(Metric, { icon: ArrowUpDown, label: "Best Fitness", value: g.best_fitness.toFixed(2), color: "text-amber-400" }), _jsx(Metric, { icon: TrendingUp, label: "Avg Return", value: `${g.avg_return >= 0 ? '+' : ''}${g.avg_return.toFixed(2)}%`, color: g.avg_return >= 0 ? 'text-green-400' : 'text-red-400' }), _jsx(Metric, { icon: Percent, label: "Avg Win Rate", value: `${g.avg_winrate.toFixed(1)}%`, color: "text-blue-400" }), _jsx(Metric, { icon: TrendingDown, label: "Avg MDD", value: `${g.avg_mdd.toFixed(2)}%`, color: "text-red-400" }), _jsxs("div", { className: "flex items-center gap-1.5 bg-surface rounded-lg px-2 py-1.5", children: [_jsx(GitBranch, { size: 10, className: "text-text-muted" }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-[9px] text-text-muted", children: "Mutations / Crossovers" }), _jsxs("div", { className: "text-[11px] font-semibold text-text-muted", children: [g.mutation_count, " / ", g.crossover_count] })] })] })] })] }, `${g.generation}-${idx}`));
                }) })] }));
}
function Metric({ icon: Icon, label, value, color }) {
    return (_jsxs("div", { className: "flex items-center gap-1.5 bg-surface rounded-lg px-2 py-1.5", children: [_jsx(Icon, { size: 10, className: "text-text-muted" }), _jsxs("div", { children: [_jsx("div", { className: "text-[9px] text-text-muted", children: label }), _jsx("div", { className: `text-[11px] font-semibold ${color}`, children: value })] })] }));
}
