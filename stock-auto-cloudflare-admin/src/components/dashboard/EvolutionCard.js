import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Cpu, Play, Clock, Users, TrendingUp } from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { CardSkeleton } from '../common/Skeleton';
export function EvolutionCard({ dash, loading }) {
    if (loading)
        return _jsx(CardSkeleton, {});
    const gen = dash?.generation;
    if (!gen) {
        return (_jsxs(Card, { children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx(Cpu, { size: 16, className: "text-text-muted" }), _jsx("h2", { className: "text-sm font-semibold text-text-primary", children: "Evolution" })] }), _jsx("p", { className: "text-xs text-text-muted", children: "No evolution data" })] }));
    }
    const isRunning = gen.status === 'RUNNING';
    return (_jsxs(Card, { children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Cpu, { size: 16, className: "text-text-muted" }), _jsx("h2", { className: "text-sm font-semibold text-text-primary", children: "Evolution" })] }), _jsx(Badge, { variant: isRunning ? 'success' : 'info', children: isRunning ? 'RUNNING' : gen.status })] }), _jsxs("div", { className: "space-y-2.5", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(TrendingUp, { size: 13, className: "text-text-muted" }), _jsx("span", { className: "text-xs text-text-muted", children: "Generation" })] }), _jsx("span", { className: "text-sm font-semibold font-mono tabular-nums", children: gen.current })] }), gen.population > 0 && (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Users, { size: 13, className: "text-text-muted" }), _jsx("span", { className: "text-xs text-text-muted", children: "Population" })] }), _jsx("span", { className: "text-xs font-mono tabular-nums", children: gen.population })] })), gen.last_run && (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Play, { size: 13, className: "text-text-muted" }), _jsx("span", { className: "text-xs text-text-muted", children: "Last Run" })] }), _jsx("span", { className: "text-xs font-mono tabular-nums text-text-muted", children: gen.last_run })] })), gen.next_scheduled && (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Clock, { size: 13, className: "text-text-muted" }), _jsx("span", { className: "text-xs text-text-muted", children: "Next" })] }), _jsx("span", { className: "text-xs font-mono tabular-nums text-text-muted", children: gen.next_scheduled })] }))] })] }));
}
