import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Rocket, CheckCircle, ListChecks } from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { CardSkeleton } from '../common/Skeleton';
const gradeColors = {
    PASS: 'success',
    WATCH: 'warning',
    FAIL: 'danger',
};
export function ReadinessCard({ dash, loading }) {
    if (loading)
        return _jsx(CardSkeleton, {});
    const r = dash?.readiness;
    if (!r) {
        return (_jsxs(Card, { children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx(Rocket, { size: 16, className: "text-text-muted" }), _jsx("h2", { className: "text-sm font-semibold text-text-primary", children: "Readiness" })] }), _jsx("p", { className: "text-xs text-text-muted", children: "No readiness data" })] }));
    }
    const color = gradeColors[r.grade] || 'danger';
    return (_jsxs(Card, { children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Rocket, { size: 16, className: "text-text-muted" }), _jsx("h2", { className: "text-sm font-semibold text-text-primary", children: "Readiness" })] }), _jsx(Badge, { variant: color, children: r.grade })] }), _jsxs("div", { className: "space-y-2.5", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("span", { className: "text-xs text-text-muted", children: "Score" }), _jsxs("span", { className: `text-xs font-mono tabular-nums ${r.score >= 80 ? 'text-success' : r.score >= 50 ? 'text-warning' : 'text-danger'}`, children: [r.score, "/100"] })] }), _jsx("div", { className: "w-full h-1.5 bg-surface rounded-full overflow-hidden", children: _jsx("div", { className: `h-full rounded-full transition-all ${r.score >= 80 ? 'bg-success' : r.score >= 50 ? 'bg-warning' : 'bg-danger'}`, style: { width: `${Math.min(100, r.score)}%` } }) })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(ListChecks, { size: 13, className: "text-text-muted" }), _jsx("span", { className: "text-xs text-text-muted", children: "Checks" })] }), _jsxs("span", { className: "text-xs font-mono tabular-nums", children: [r.passed, "/", r.total] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(CheckCircle, { size: 13, className: "text-text-muted" }), _jsx("span", { className: "text-xs text-text-muted", children: "Verdict" })] }), _jsx(Badge, { variant: r.verdict === 'PASS' ? 'success' : 'warning', children: r.verdict })] })] })] }));
}
