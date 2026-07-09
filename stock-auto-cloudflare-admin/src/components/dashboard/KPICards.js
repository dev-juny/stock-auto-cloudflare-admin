import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { TrendingUp, TrendingDown, BarChart3, Target, DollarSign } from 'lucide-react';
import { Card } from '../common/Card';
import { CardSkeleton } from '../common/Skeleton';
import { Tooltip } from '../common/Tooltip';
import { formatPct } from '../../utils/format';
import { findGlossary } from '../../utils/glossary';
export function KPICards({ dash, loading }) {
    if (loading) {
        return (_jsx("div", { className: "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5", children: [1, 2, 3, 4, 5, 6].map((i) => _jsx(CardSkeleton, {}, i)) }));
    }
    const port = dash?.portfolio;
    const paper = dash?.paper_trading;
    const risk = dash?.risk;
    const totalReturn = port?.total_return ?? paper?.total_return ?? 0;
    const mdd = port?.mdd ?? risk?.mdd ?? 0;
    const winRate = paper?.win_rate ?? 0;
    const profitFactor = paper?.profit_factor ?? 0;
    const sharpe = port?.sharpe ?? 0;
    const cagr = port?.cagr ?? 0;
    const labelKeys = {
        'Total Return': 'return',
        'CAGR': 'cagr',
        'MDD': 'mdd',
        'Sharpe': 'sharpe',
        'Win Rate': 'winRate',
        'Profit Factor': 'profitFactor',
    };
    const kpis = [
        { label: 'Total Return', value: formatPct(totalReturn), sub: `PF Grade: ${port?.pf_grade ?? paper?.pf_grade ?? 'N/A'}`, icon: TrendingUp, positive: totalReturn >= 0 },
        { label: 'CAGR', value: cagr > 0 ? `${cagr.toFixed(1)}%` : '-', sub: '연환산 수익률', icon: TrendingUp, positive: cagr > 0 },
        { label: 'MDD', value: `${mdd.toFixed(1)}%`, sub: '최대 손실 구간', icon: TrendingDown, positive: mdd < 10 ? true : mdd < 20 ? undefined : false },
        { label: 'Sharpe', value: sharpe > 0 ? sharpe.toFixed(2) : '-', sub: '위험조정 수익률', icon: BarChart3, positive: sharpe >= 1 },
        { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, sub: `${paper?.total_trades ?? 0}건`, icon: Target, positive: winRate >= 50 },
        { label: 'Profit Factor', value: profitFactor === Infinity ? '∞' : profitFactor.toFixed(2), sub: '수익/손실 비율', icon: DollarSign, positive: profitFactor > 1.5, neutral: profitFactor === Infinity || profitFactor <= 1.5 },
    ];
    return (_jsx("div", { className: "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5", children: kpis.map((kpi) => {
            const Icon = kpi.icon;
            const isPositive = kpi.positive;
            const g = findGlossary(labelKeys[kpi.label]);
            return (_jsxs(Card, { className: "!p-3", children: [_jsxs("div", { className: "flex items-center justify-between mb-1.5", children: [g ? (_jsx(Tooltip, { content: g.description, size: 12, children: _jsx("span", { className: "text-[10px] font-medium text-text-muted tracking-wide", children: kpi.label }) })) : (_jsx("span", { className: "text-[10px] font-medium text-text-muted tracking-wide", children: kpi.label })), _jsx(Icon, { size: 13, className: isPositive ? 'text-success' : kpi.positive === false ? 'text-danger' : 'text-primary' })] }), _jsx("div", { className: `kpi-value !text-lg leading-tight ${kpi.neutral ? 'text-text-primary' :
                            isPositive ? 'text-success' : 'text-danger'}`, children: kpi.value }), kpi.sub && _jsx("div", { className: "text-[10px] text-text-muted mt-0.5", children: kpi.sub })] }, kpi.label));
        }) }));
}
