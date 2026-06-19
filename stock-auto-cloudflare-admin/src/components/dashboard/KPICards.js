import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Target, DollarSign } from 'lucide-react';
import { Card } from '../common/Card';
import { CardSkeleton } from '../common/Skeleton';
import { formatKRW, formatPct } from '../../utils/format';
import { api } from '../../utils/api';
export function KPICards({ portfolio, loading }) {
    const [performanceData, setPerformanceData] = useState({ mdd: null, cagr: null });
    useEffect(() => {
        api.get('/api/portfolio/performance')
            .then(d => {
            if (!d?.snapshots?.length)
                return;
            const snapshots = d.snapshots;
            const firstPnl = snapshots[snapshots.length - 1]?.pnl_pct ?? 0;
            const lastPnl = snapshots[0]?.pnl_pct ?? 0;
            let maxPnl = -Infinity;
            let maxMdd = 0;
            for (const s of snapshots) {
                if (s.pnl_pct > maxPnl)
                    maxPnl = s.pnl_pct;
                const dd = maxPnl - s.pnl_pct;
                if (dd > maxMdd)
                    maxMdd = dd;
            }
            const days = snapshots.length;
            const years = days / 365;
            const cagrVal = years > 0 && firstPnl !== 0
                ? ((1 + lastPnl / 100) ** (1 / years) - 1) * 100
                : null;
            setPerformanceData({ mdd: -maxMdd, cagr: cagrVal });
        })
            .catch(() => { });
    }, []);
    const totalPnl = portfolio?.totalPnl ?? 0;
    const totalPnlPct = portfolio?.totalPnlPct ?? 0;
    const holdings = portfolio?.holdings ?? [];
    const holdingCount = holdings.length;
    const winCount = holdings.filter(h => Number(h.evlu_pfls_amt) > 0).length;
    const winRate = holdingCount > 0 ? (winCount / holdingCount) * 100 : 0;
    const posSum = holdings.reduce((s, h) => { const v = Number(h.evlu_pfls_amt); return v > 0 ? s + v : s; }, 0);
    const negSum = holdings.reduce((s, h) => { const v = Number(h.evlu_pfls_amt); return v < 0 ? s + Math.abs(v) : s; }, 0);
    const profitFactor = negSum > 0 ? posSum / negSum : posSum > 0 ? Infinity : 0;
    const avgPnl = holdingCount > 0 ? totalPnl / holdingCount : 0;
    const mdd = performanceData.mdd;
    const cagr = performanceData.cagr;
    const kpis = [
        { label: '총 수익률', value: formatPct(totalPnlPct), sub: formatKRW(totalPnl), icon: TrendingUp, positive: totalPnl >= 0 },
        { label: 'CAGR', value: cagr !== null ? `${cagr.toFixed(1)}%` : '-', sub: '연환산 수익률', icon: TrendingUp, positive: cagr !== null && cagr > 0 },
        { label: 'MDD', value: mdd !== null ? `${mdd.toFixed(1)}%` : '-', sub: '최대 손실 구간', icon: TrendingDown, positive: mdd !== null ? false : undefined },
        { label: '승률', value: `${winRate.toFixed(1)}%`, sub: `${holdingCount}건`, icon: Target, positive: winRate >= 50 },
        { label: 'Profit Factor', value: profitFactor === Infinity ? '∞' : profitFactor.toFixed(2), sub: '수익/손실 비율', icon: BarChart3, positive: profitFactor > 1.5, neutral: profitFactor === Infinity || profitFactor <= 1.5 },
        { label: 'Expectancy', value: `${avgPnl >= 0 ? '+' : ''}${formatKRW(avgPnl)}`, sub: '평균 기대 수익', icon: DollarSign, positive: avgPnl >= 0 },
    ];
    if (loading) {
        return (_jsx("div", { className: "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5", children: [1, 2, 3, 4, 5, 6].map((i) => _jsx(CardSkeleton, {}, i)) }));
    }
    return (_jsx("div", { className: "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5", children: kpis.map((kpi) => {
            const Icon = kpi.icon;
            const isPositive = kpi.positive;
            return (_jsxs(Card, { className: "!p-3", children: [_jsxs("div", { className: "flex items-center justify-between mb-1.5", children: [_jsx("span", { className: "text-[10px] font-medium text-text-muted tracking-wide", children: kpi.label }), _jsx(Icon, { size: 13, className: isPositive ? 'text-success' : kpi.positive === false ? 'text-danger' : 'text-primary' })] }), _jsx("div", { className: `kpi-value !text-lg leading-tight ${kpi.neutral ? 'text-text-primary' :
                            isPositive ? 'text-success' : 'text-danger'}`, children: kpi.value }), kpi.sub && _jsx("div", { className: "text-[10px] text-text-muted mt-0.5", children: kpi.sub })] }, kpi.label));
        }) }));
}
