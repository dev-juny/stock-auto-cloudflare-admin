import { useEffect, useRef } from 'react'
import { createChart, ColorType, HistogramSeries, HistogramData } from 'lightweight-charts'
import { Card } from '../common/Card'
import { CardSkeleton } from '../common/Skeleton'
import { useTrades } from '../../hooks/useTrades'

export function DrawdownChart() {
  const chartRef = useRef<HTMLDivElement>(null)
  const { trades, loading } = useTrades()

  useEffect(() => {
    if (!chartRef.current || loading) return

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
      rightPriceScale: { borderColor: '#1F2937', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: '#1F2937', timeVisible: false, fixRightEdge: true },
      width: chartRef.current.clientWidth,
      height: 140,
      handleScroll: false,
      handleScale: false,
    })

    const hist = chart.addSeries(HistogramSeries, {
      color: '#EF4444',
      priceFormat: { type: 'percent', precision: 1 },
    })

    if (trades.length > 0) {
      let cumPnl = 100
      let peak = 100
      const ddData: HistogramData[] = []
      const sorted = [...trades].sort((a, b) => new Date(a.traded_at).getTime() - new Date(b.traded_at).getTime())

      sorted.forEach((t) => {
        const dayStr = t.traded_at?.slice(0, 10)
        if (!dayStr) return
        const pnlPct = t.pnl_pct ?? 0
        cumPnl = cumPnl * (1 + pnlPct / 100)
        peak = Math.max(peak, cumPnl)
        ddData.push({ time: dayStr as any, value: Math.min(((cumPnl - peak) / peak) * 100, 0) })
      })

      hist.setData(ddData)
    }

    const handleResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth })
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [loading])

  return (
    <Card>
      <h2 className="text-sm font-semibold text-text-primary mb-2">Drawdown</h2>
      {loading ? <CardSkeleton /> : <div ref={chartRef} className="w-full" style={{ height: 140 }} />}
    </Card>
  )
}
