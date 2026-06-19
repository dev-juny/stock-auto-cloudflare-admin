import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { createChart, ColorType, LineSeries } from 'lightweight-charts';
import { Card } from '../common/Card';
import { CardSkeleton } from '../common/Skeleton';
import { useTrades } from '../../hooks/useTrades';
export function EquityCurve() {
    const chartRef = useRef(null);
    const { trades, loading } = useTrades();
    useEffect(() => {
        if (!chartRef.current || loading)
            return;
        const chart = createChart(chartRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#9CA3AF',
                fontSize: 10,
            },
            grid: {
                vertLines: { color: '#1F2937' },
                horzLines: { color: '#1F2937' },
            },
            crosshair: { vertLine: { color: '#3B82F6', width: 1, style: 2 } },
            rightPriceScale: { borderColor: '#1F2937', scaleMargins: { top: 0.05, bottom: 0.05 } },
            timeScale: { borderColor: '#1F2937', timeVisible: false, fixRightEdge: true },
            width: chartRef.current.clientWidth,
            height: 220,
            handleScroll: false,
            handleScale: false,
        });
        const equity = chart.addSeries(LineSeries, {
            color: '#22C55E',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 3,
            priceFormat: { type: 'percent', precision: 1 },
        });
        const benchmark = chart.addSeries(LineSeries, {
            color: '#3B82F6',
            lineWidth: 1,
            lineStyle: 2,
            crosshairMarkerVisible: false,
            priceFormat: { type: 'percent', precision: 1 },
        });
        if (trades.length > 0) {
            let cumPnl = 100;
            const eqData = [{ time: '2024-01-01', value: cumPnl }];
            const bmkData = [{ time: '2024-01-01', value: 100 }];
            const sorted = [...trades].sort((a, b) => new Date(a.traded_at).getTime() - new Date(b.traded_at).getTime());
            sorted.forEach((t, i) => {
                const dayStr = t.traded_at?.slice(0, 10);
                if (!dayStr)
                    return;
                const pnlPct = t.pnl_pct ?? 0;
                cumPnl = cumPnl * (1 + pnlPct / 100);
                eqData.push({ time: dayStr, value: cumPnl });
                bmkData.push({ time: dayStr, value: 100 + (i / sorted.length) * 8 });
            });
            equity.setData(eqData);
            benchmark.setData(bmkData);
        }
        const handleResize = () => {
            if (chartRef.current)
                chart.applyOptions({ width: chartRef.current.clientWidth });
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [loading]);
    return (_jsxs(Card, { children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h2", { className: "text-sm font-semibold text-text-primary", children: "Equity Curve" }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsxs("span", { className: "flex items-center gap-1 text-[10px] text-success", children: [_jsx("span", { className: "w-2 h-0.5 rounded bg-success" }), " \uC804\uB7B5"] }), _jsxs("span", { className: "flex items-center gap-1 text-[10px] text-primary ml-2", children: [_jsx("span", { className: "w-2 h-0.5 rounded bg-primary" }), " \uBCA4\uCE58\uB9C8\uD06C"] })] })] }), loading ? _jsx(CardSkeleton, {}) : _jsx("div", { ref: chartRef, className: "w-full", style: { height: 220 } })] }));
}
