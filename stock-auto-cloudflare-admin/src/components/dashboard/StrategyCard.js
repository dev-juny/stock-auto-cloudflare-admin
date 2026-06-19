import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Settings, Play } from 'lucide-react';
import { Card } from '../common/Card';
import { CardSkeleton } from '../common/Skeleton';
import { Badge } from '../common/Badge';
import { api } from '../../utils/api';
export function StrategyCard() {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        api.get('/api/backtest/configs')
            .then((list) => {
            const arr = Array.isArray(list) ? list : [];
            const active = arr.find((c) => c.is_active);
            if (active) {
                const p = parseParams(active.params);
                setSummary({
                    active: true,
                    name: active.name,
                    tags: buildTags(p),
                    params: p,
                });
            }
            else {
                setSummary(null);
            }
        })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);
    if (loading)
        return _jsx(CardSkeleton, {});
    return (_jsxs(Card, { children: [_jsxs("button", { onClick: () => setOpen(!open), className: "w-full flex items-center justify-between min-h-[44px]", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx(Settings, { size: 16, className: "text-text-muted" }), _jsxs("div", { className: "text-left", children: [_jsx("h2", { className: "text-sm font-semibold text-text-primary", children: "\uC804\uB7B5 \uC124\uC815" }), summary && (_jsx("p", { className: "text-[10px] text-text-muted mt-0.5", children: summary.name }))] })] }), summary ? (_jsx(Badge, { variant: "success", children: "\uD65C\uC131" })) : (_jsx("span", { className: "text-xs text-text-muted", children: "\uBE44\uD65C\uC131" }))] }), summary && (_jsxs("div", { className: "mt-3", children: [_jsx("div", { className: "flex flex-wrap gap-1.5", children: summary.tags.map((t) => (_jsx("span", { className: "text-[10px] px-2 py-1 rounded-lg bg-surface border border-surface-border text-text-secondary font-mono", children: t }, t))) }), _jsxs("button", { onClick: () => setOpen(!open), className: "flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary mt-2.5 transition-colors min-h-[36px]", children: [open ? _jsx(ChevronUp, { size: 14 }) : _jsx(ChevronDown, { size: 14 }), open ? '파라미터 접기' : '파라미터 상세'] }), open && (_jsx("div", { className: "mt-2 p-3 bg-surface rounded-xl border border-surface-border space-y-1.5", children: renderParams(summary.params) }))] })), !summary && (_jsxs("div", { className: "mt-3", children: [_jsxs("div", { className: "flex flex-wrap gap-1.5", children: [_jsxs("span", { className: "text-[10px] px-2 py-1 rounded-lg bg-surface border border-surface-border text-text-muted", children: ["Volume ", '>', " 500K"] }), _jsxs("span", { className: "text-[10px] px-2 py-1 rounded-lg bg-surface border border-surface-border text-text-muted", children: ["Volatility ", '<', " 12%"] }), _jsx("span", { className: "text-[10px] px-2 py-1 rounded-lg bg-surface border border-surface-border text-text-muted", children: "TP 7%" })] }), _jsxs("button", { className: "flex items-center gap-1.5 text-[11px] text-text-muted mt-2 min-h-[36px] transition-colors hover:text-text-primary", children: [_jsx(Play, { size: 12 }), " \uBC31\uD14C\uC2A4\uD2B8\uC5D0\uC11C \uC804\uB7B5 \uC124\uC815\uD558\uAE30"] })] }))] }));
}
function parseParams(raw) {
    try {
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
function buildTags(p) {
    const t = [];
    if (p.entryType)
        t.push(`${p.entryType}`);
    if (p.fixedTakeProfitPct)
        t.push(`TP ${(Number(p.fixedTakeProfitPct) * 100).toFixed(0)}%`);
    if (p.trailingStopPct)
        t.push(`TS ${(Number(p.trailingStopPct) * 100).toFixed(0)}%`);
    if (p.stopLossPct && Number(p.stopLossPct) > 0)
        t.push(`SL ${(Number(p.stopLossPct) * 100).toFixed(0)}%`);
    if (p.minVolume)
        t.push(`Vol ${Number(p.minVolume).toLocaleString()}`);
    if (p.maxVolatility && Number(p.maxVolatility) < 1)
        t.push(`Volat ${(Number(p.maxVolatility) * 100).toFixed(0)}%`);
    if (p.maxConcurrentPositions)
        t.push(`Max ${p.maxConcurrentPositions}`);
    if (p.stallExitDays)
        t.push(`Stall ${p.stallExitDays}d`);
    return t;
}
function renderParams(p) {
    const rows = [];
    const add = (label, val, fmt) => {
        if (val !== undefined && val !== null && val !== '') {
            rows.push({ label, value: fmt ? fmt(val) : String(val) });
        }
    };
    add('Entry', p.entryType);
    add('Trigger', p.entryTrigger);
    add('Take Profit', p.fixedTakeProfitPct, (v) => `${(Number(v) * 100).toFixed(0)}%`);
    add('Break Even', p.breakEvenActivationPct, (v) => `${(Number(v) * 100).toFixed(0)}%`);
    add('Trailing Start', p.trailingActivationPct, (v) => `${(Number(v) * 100).toFixed(0)}%`);
    add('Trailing Stop', p.trailingStopPct, (v) => `${(Number(v) * 100).toFixed(0)}%`);
    add('Stop Loss', p.stopLossPct, (v) => Number(v) > 0 ? `${(Number(v) * 100).toFixed(0)}%` : '-');
    add('Stall Exit', p.stallExitDays, (v) => `${v}d`);
    add('Max Positions', p.maxConcurrentPositions);
    add('Min Volume', p.minVolume, (v) => Number(v).toLocaleString());
    add('Max Volatility', p.maxVolatility, (v) => `${(Number(v) * 100).toFixed(0)}%`);
    return rows.map((r) => (_jsxs("div", { className: "flex items-center justify-between py-1", children: [_jsx("span", { className: "text-[11px] text-text-muted", children: r.label }), _jsx("span", { className: "text-[11px] text-text-primary font-mono tabular-nums", children: r.value })] }, r.label)));
}
