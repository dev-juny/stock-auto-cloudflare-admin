import { useState, useEffect, useRef } from 'react'
import { api } from '../utils/api'
import { Card } from '../components/common/Card'
import { CardSkeleton } from '../components/common/Skeleton'
import { Badge } from '../components/common/Badge'
import { createChart, ColorType, LineSeries, HistogramSeries } from 'lightweight-charts'
import type { ValidationStatus, ValidationDashboard } from '../utils/api'
import {
  Activity, TrendingUp, TrendingDown, Target, BarChart3,
  RefreshCw, Calendar, Play, Square, XCircle,
} from 'lucide-react'
import { formatKST } from '../utils/kst'

export default function ValidationDashboardPage() {
  const [data, setData] = useState<ValidationStatus | null>(null)
  const [dashboard, setDashboard] = useState<ValidationDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sharpeRef = useRef<HTMLDivElement>(null)
  const mddRef = useRef<HTMLDivElement>(null)
  const pfRef = useRef<HTMLDivElement>(null)
  const wrRef = useRef<HTMLDivElement>(null)

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [val, adv] = await Promise.all([
        api.get<ValidationStatus>('/api/validation/status'),
        api.get<ValidationDashboard>('/api/validation/dashboard'),
      ])
      setData(val)
      setDashboard(adv)
    } catch (e: any) {
      setError(e.message || 'Failed to load validation data')
    }
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  // Charts
  useEffect(() => {
    if (!dashboard || loading) return
    const charts: any[] = []
    const am = dashboard.advanced_metrics || {}

    const opts = {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#9CA3AF', fontSize: 10 },
      grid: { vertLines: { color: '#1F2937' }, horzLines: { color: '#1F2937' } },
      rightPriceScale: { borderColor: '#1F2937', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: '#1F2937', visible: false },
      width: 0, height: 80,
      handleScroll: false, handleScale: false,
      autoSize: true,
    }

    if (sharpeRef.current && am.rolling_sharpe_series?.length > 0) {
      const ch = createChart(sharpeRef.current, { ...opts })
      const s = ch.addSeries(LineSeries, { color: '#22C55E', lineWidth: 2 })
      s.setData(am.rolling_sharpe_series.map((v, i) => ({ time: String(i), value: v } as any)))
      charts.push(ch)
    }

    if (mddRef.current && am.rolling_mdd_series?.length > 0) {
      const ch = createChart(mddRef.current, { ...opts })
      const s = ch.addSeries(HistogramSeries, { color: '#EF4444' })
      s.setData(am.rolling_mdd_series.map((v, i) => ({ time: String(i), value: Math.min(v, 0) } as any)))
      charts.push(ch)
    }

    if (pfRef.current && am.rolling_pf_series?.length > 0) {
      const ch = createChart(pfRef.current, { ...opts })
      const s = ch.addSeries(LineSeries, { color: '#3B82F6', lineWidth: 2 })
      s.setData(am.rolling_pf_series.map((v, i) => ({ time: String(i), value: Math.min(v, 10) } as any)))
      charts.push(ch)
    }

    if (wrRef.current && am.rolling_win_rate_series?.length > 0) {
      const ch = createChart(wrRef.current, { ...opts })
      const s = ch.addSeries(LineSeries, { color: '#A78BFA', lineWidth: 2 })
      s.setData(am.rolling_win_rate_series.map((v, i) => ({ time: String(i), value: v } as any)))
      charts.push(ch)
    }

    return () => charts.forEach(c => c.remove())
  }, [dashboard, loading])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-5 w-32" />
        <div className="grid grid-cols-2 gap-3">{[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <XCircle size={24} className="text-red-400" />
        <p className="text-xs text-text-muted">{error}</p>
        <button onClick={loadAll} className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20">Retry</button>
      </div>
    )
  }

  const isActive = data?.is_active ?? dashboard?.active ?? false
  const startedAt = data?.started_at || dashboard?.started_at || ''
  const elapsedDays = dashboard?.progress?.elapsed_days ?? 0
  const metrics = dashboard?.metrics
  const am = dashboard?.advanced_metrics
  const hasSharpe = (am?.rolling_sharpe_series?.length ?? 0) > 0
  const hasMdd = (am?.rolling_mdd_series?.length ?? 0) > 0
  const hasPf = (am?.rolling_pf_series?.length ?? 0) > 0
  const hasWr = (am?.rolling_win_rate_series?.length ?? 0) > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">Validation Dashboard</h2>
        <div className="flex items-center gap-2">
          <Badge variant={isActive ? 'success' : 'muted'}>{isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>
          <button onClick={loadAll} className="p-2 text-text-muted hover:text-text">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Status */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Activity size={16} className={isActive ? 'text-green-400' : 'text-text-muted'} />
          <span className="text-sm font-semibold text-text">Validation Status</span>
          {startedAt && <span className="text-[10px] text-text-muted">since {formatKST(startedAt)}</span>}
        </div>
        {isActive && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-green-400 transition-all" style={{ width: `${Math.min(elapsedDays / 30 * 100, 100)}%` }} />
            </div>
            <span className="text-xs text-text-muted tabular-nums">{elapsedDays.toFixed(0)}/30 days</span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-surface rounded-xl p-3 text-center">
            <div className="text-text-muted text-[10px]">Total Return</div>
            <div className={`font-bold text-sm ${(metrics?.cumulative_return ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(metrics?.cumulative_return ?? 0) >= 0 ? '+' : ''}{(metrics?.cumulative_return ?? 0).toFixed(2)}%
            </div>
          </div>
          <div className="bg-surface rounded-xl p-3 text-center">
            <div className="text-text-muted text-[10px]">MDD</div>
            <div className="font-bold text-sm text-red-400">{(metrics?.max_drawdown ?? 0).toFixed(1)}%</div>
          </div>
          <div className="bg-surface rounded-xl p-3 text-center">
            <div className="text-text-muted text-[10px]">Win Rate</div>
            <div className="font-bold text-sm text-blue-400">{(metrics?.win_rate ?? 0).toFixed(1)}%</div>
          </div>
        </div>
      </Card>

      {/* Advanced Metrics */}
      {dashboard && metrics && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <div className="flex items-center gap-1 text-text-muted mb-1">
                <BarChart3 size={12} />
                <span className="text-[10px]">Sharpe</span>
              </div>
              <div className={`text-lg font-bold font-mono tabular-nums ${(metrics.sharpe ?? 0) >= 1 ? 'text-green-400' : (metrics.sharpe ?? 0) >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                {(metrics.sharpe ?? 0).toFixed(2)}
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-1 text-text-muted mb-1">
                <TrendingUp size={12} />
                <span className="text-[10px]">Alpha</span>
              </div>
              <div className={`text-lg font-bold font-mono tabular-nums ${(am?.alpha ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(am?.alpha ?? 0) >= 0 ? '+' : ''}{(am?.alpha ?? 0).toFixed(4)}
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-1 text-text-muted mb-1">
                <TrendingDown size={12} />
                <span className="text-[10px]">Beta</span>
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-text">
                {(am?.beta ?? 0).toFixed(4)}
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-1 text-text-muted mb-1">
                <Target size={12} />
                <span className="text-[10px]">Profit Factor</span>
              </div>
              <div className={`text-lg font-bold font-mono tabular-nums ${metrics.profit_factor >= 1.5 ? 'text-green-400' : 'text-text'}`}>
                {(metrics.profit_factor ?? 0) === Infinity ? '∞' : (metrics.profit_factor ?? 0).toFixed(2)}
              </div>
            </Card>
          </div>

          {/* Rolling Charts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {hasSharpe && (
              <Card>
                <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">Rolling Sharpe</h3>
                <div ref={sharpeRef} className="w-full" style={{ height: 100 }} />
              </Card>
            )}
            {hasMdd && (
              <Card>
                <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">Rolling MDD</h3>
                <div ref={mddRef} className="w-full" style={{ height: 100 }} />
              </Card>
            )}
            {hasPf && (
              <Card>
                <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">Rolling PF</h3>
                <div ref={pfRef} className="w-full" style={{ height: 100 }} />
              </Card>
            )}
            {hasWr && (
              <Card>
                <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">Rolling Win Rate</h3>
                <div ref={wrRef} className="w-full" style={{ height: 100 }} />
              </Card>
            )}
          </div>

          {/* Monthly Heatmap */}
          {dashboard.monthly_heatmap && Object.keys(dashboard.monthly_heatmap).length > 0 && (
            <Card>
              <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">Monthly Returns</h3>
              <div className="grid grid-cols-6 gap-1.5">
                {Object.entries(dashboard.monthly_heatmap).flatMap(([year, months]) =>
                  Object.entries(months).map(([month, ret]) => (
                    <div key={`${year}-${month}`} className={`px-2 py-1.5 rounded-lg text-center text-xs font-mono tabular-nums ${
                      ret >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                    }`}>
                      <div className="text-[9px] text-text-muted">{year}.{month}</div>
                      <div className="font-bold">{ret >= 0 ? '+' : ''}{ret.toFixed(1)}%</div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}

          {/* Daily Log */}
          {dashboard.daily_logs && dashboard.daily_logs.length > 0 && (
            <Card>
              <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">Daily Log</h3>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {[...dashboard.daily_logs].reverse().map(log => (
                  <div key={log.date} className="flex items-center justify-between bg-surface rounded-lg px-2.5 py-1.5 text-xs">
                    <span className="text-text-muted text-[10px]">{log.date}</span>
                    <div className="flex gap-3">
                      <span className={log.daily_return >= 0 ? 'text-green-400' : 'text-red-400'}>{log.daily_return >= 0 ? '+' : ''}{log.daily_return.toFixed(2)}%</span>
                      <span className="text-text">{log.cumulative_return.toFixed(2)}%</span>
                      <span className="text-blue-400">{log.win_rate.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
