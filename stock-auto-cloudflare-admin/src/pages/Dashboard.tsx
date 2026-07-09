import { KPICards } from '../components/dashboard/KPICards'
import { SystemStatusCard } from '../components/dashboard/SystemStatusCard'
import { StrategyCard } from '../components/dashboard/StrategyCard'
import { PositionsCard } from '../components/dashboard/PositionsCard'
import { TradeHistory } from '../components/dashboard/TradeHistory'
import { LogViewer } from '../components/dashboard/LogViewer'
import { EvolutionCard } from '../components/dashboard/EvolutionCard'
import { RiskSummaryCard } from '../components/dashboard/RiskSummaryCard'
import { ValidationProgressCard } from '../components/dashboard/ValidationProgressCard'
import { ReadinessCard } from '../components/dashboard/ReadinessCard'
import { useDashboard } from '../hooks/useDashboard'
import { Card } from '../components/common/Card'
import { CardSkeleton } from '../components/common/Skeleton'
import { Gauge, TrendingUp, TrendingDown, Activity, ShoppingCart, BarChart3, Calendar, Clock } from 'lucide-react'

export function Dashboard() {
  const { data: dash, loading, refetch } = useDashboard()

  const paper = dash?.paper_trading
  const val = dash?.validation
  const risk = dash?.risk
  const gen = dash?.generation

  return (
    <div className="space-y-3 pb-24">
      <KPICards dash={dash} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SystemStatusCard dash={dash} loading={loading} onRefresh={refetch} />
        <EvolutionCard dash={dash} loading={loading} />
      </div>

      {/* Portfolio Gauges */}
      {!loading && dash && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <div className="flex items-center gap-2 mb-2">
              <Gauge size={14} className="text-primary" />
              <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Exposure</span>
            </div>
            <div className="relative pt-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-muted">Capital Deployed</span>
                <span className={`text-xs font-mono tabular-nums ${(dash.system?.exposure_pct ?? 0) > 90 ? 'text-red-400' : (dash.system?.exposure_pct ?? 0) > 70 ? 'text-amber-400' : 'text-green-400'}`}>
                  {dash.system?.exposure_pct?.toFixed(1) ?? risk?.exposure_pct?.toFixed(1) ?? '-'}%
                </span>
              </div>
              <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, dash.system?.exposure_pct ?? risk?.exposure_pct ?? 0)}%` }} />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-2">
              <Gauge size={14} className="text-blue-400" />
              <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Cash Ratio</span>
            </div>
            <div className="relative pt-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-muted">Available Cash</span>
                <span className={`text-xs font-mono tabular-nums ${(dash.system?.cash_ratio_pct ?? 0) < 10 ? 'text-red-400' : 'text-green-400'}`}>
                  {dash.system?.cash_ratio_pct?.toFixed(1) ?? risk?.cash_ratio?.toFixed(1) ?? '-'}%
                </span>
              </div>
              <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-blue-400 transition-all"
                  style={{ width: `${Math.min(100, dash.system?.cash_ratio_pct ?? risk?.cash_ratio ?? 0)}%` }} />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-2">
              <Activity size={14} className="text-amber-400" />
              <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Paper Trading</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Buys</span>
                <span className="text-green-400 font-mono tabular-nums">{((paper?.total_trades ?? 0) - (paper?.sell_trades ?? 0))}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Sells</span>
                <span className="text-red-400 font-mono tabular-nums">{paper?.sell_trades ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Open</span>
                <span className="text-amber-400 font-mono tabular-nums">{paper?.open_positions ?? paper?.sell_trades ?? 0}</span>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 size={14} className="text-purple-400" />
              <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Evolution</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Generation</span>
                <span className="text-text font-mono tabular-nums">{gen?.current ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Best PF</span>
                <span className="text-amber-400 font-mono tabular-nums">{dash?.portfolio?.latest_pf?.toFixed(2) ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Avg PF</span>
                <span className="text-text font-mono tabular-nums">{dash?.portfolio?.profit_factor?.toFixed(2) ?? '-'}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Validation Progress */}
      {!loading && dash && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <div className="flex items-center gap-2 mb-2">
              <Activity size={14} className={val?.active ? 'text-green-400' : 'text-text-muted'} />
              <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Validation</span>
              {val?.active && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 ml-auto">Active</span>}
            </div>
            {val?.active ? (
              <div className="relative pt-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-text-muted">Progress</span>
                  <span className="text-xs font-mono tabular-nums">{(val.progress?.progress_pct as number)?.toFixed(0) ?? 0}%</span>
                </div>
                <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-green-400 transition-all"
                    style={{ width: `${Math.min(100, (val.progress?.progress_pct as number) ?? 0)}%` }} />
                </div>
              </div>
            ) : (
              <div className="text-xs text-text-muted">Inactive</div>
            )}
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart size={14} className="text-text-muted" />
              <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Buy Count</span>
            </div>
            <div className="text-lg font-bold text-green-400 font-mono tabular-nums">
              {((paper?.total_trades ?? 0) - (paper?.sell_trades ?? 0))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown size={14} className="text-text-muted" />
              <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Open Positions</span>
            </div>
            <div className="text-lg font-bold text-amber-400 font-mono tabular-nums">
              {paper?.open_positions ?? risk?.open_positions ?? 0}
            </div>
          </Card>
        </div>
      )}

      {/* Risk BLOCKED card */}
      {!loading && dash && risk?.blocked && (
        <Card className="!border-red-500/30 !bg-red-500/5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={16} className="text-red-400" />
            <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Risk BLOCKED</span>
          </div>
          {risk.reasons.map((r, i) => (
            <div key={i} className="text-xs text-red-400/80 py-0.5">{r}</div>
          ))}
        </Card>
      )}

      {/* Scheduler info */}
      {!loading && dash?.generation?.last_run && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <Calendar size={14} className="text-text-muted" />
              <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Last Run</span>
            </div>
            <span className="text-xs font-mono tabular-nums">{gen?.last_run ?? '-'}</span>
          </Card>
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-text-muted" />
              <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Next Run</span>
            </div>
            <span className="text-xs font-mono tabular-nums">{gen?.next_scheduled ?? '-'}</span>
          </Card>
        </div>
      )}

      {/* Risk / Validation / Readiness */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <RiskSummaryCard dash={dash} loading={loading} />
        <ValidationProgressCard dash={dash} loading={loading} />
        <ReadinessCard dash={dash} loading={loading} />
      </div>

      <PositionsCard />
      <StrategyCard />
      <TradeHistory />
      <LogViewer />
    </div>
  )
}
