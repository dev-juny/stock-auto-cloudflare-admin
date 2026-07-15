import { ShieldAlert, Shield, AlertTriangle, Ban, DollarSign, Percent, Info, ArrowUp } from 'lucide-react'
import { Card } from '../common/Card'
import { Badge } from '../common/Badge'
import { CardSkeleton } from '../common/Skeleton'
import { Tooltip } from '../common/Tooltip'
import { DashboardResponse } from '../../utils/api'

interface Props {
  dash: DashboardResponse | null
  loading: boolean
}

export function RiskSummaryCard({ dash, loading }: Props) {
  if (loading) return <CardSkeleton />

  const risk = dash?.risk
  const system = dash?.system
  if (!risk) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert size={16} className="text-text-muted" />
          <h2 className="text-sm font-semibold text-text-primary">Risk</h2>
        </div>
        <p className="text-xs text-text-muted">No risk data</p>
      </Card>
    )
  }

  const blocked = risk.blocked
  const exposure = system?.exposure_pct ?? risk.exposure_pct
  const cashRatio = risk.cash_ratio
  const allowed = risk.max_capital_deployment

  function barColor(pct: number) {
    if (pct > 80) return '#ef4444'
    if (pct > 60) return '#f59e0b'
    return '#22c55e'
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {blocked ? <ShieldAlert size={16} className="text-danger" /> : <Shield size={16} className="text-text-muted" />}
          <h2 className="text-sm font-semibold text-text-primary">Risk</h2>
        </div>
        <Badge variant={blocked ? 'danger' : risk.status === 'PASS' ? 'success' : 'warning'}>
          {blocked ? 'BLOCKED' : risk.status}
        </Badge>
      </div>

      <div className="space-y-3">
        {/* Exposure bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-text-muted">Exposure</span>
            <span className={`font-mono tabular-nums ${exposure > 80 ? 'text-danger' : exposure > 60 ? 'text-warning' : 'text-text-primary'}`}>
              {exposure.toFixed(1)}%
            </span>
          </div>
          <div className="relative w-full h-2.5 bg-surface rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, exposure)}%`, background: barColor(exposure) }} />
            {allowed > 0 && (
              <div className="absolute top-0 w-0.5 h-full bg-white/40 rounded-full"
                style={{ left: `${Math.min(100, allowed)}%` }} />
            )}
          </div>
          {allowed > 0 && (
            <div className="text-[9px] text-text-muted/40 mt-0.5">Allowed limit: {allowed.toFixed(1)}%</div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign size={13} className="text-text-muted" />
            <span className="text-xs text-text-muted">Cash Ratio</span>
          </div>
          <span className={`text-xs font-mono tabular-nums ${cashRatio < 10 ? 'text-danger' : 'text-text-primary'}`}>
            {cashRatio.toFixed(1)}%
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ban size={13} className="text-text-muted" />
            <span className="text-xs text-text-muted">Open Positions</span>
          </div>
          <span className="text-xs font-mono tabular-nums">{risk.open_positions}</span>
        </div>

        {risk.mdd > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className="text-text-muted" />
              <span className="text-xs text-text-muted">MDD</span>
            </div>
            <span className={`text-xs font-mono tabular-nums ${risk.mdd > 20 ? 'text-danger' : risk.mdd > 10 ? 'text-warning' : 'text-text-primary'}`}>
              {risk.mdd.toFixed(1)}%
            </span>
          </div>
        )}

        {blocked && (
          <div className="mt-1 p-2 bg-danger/10 rounded-lg">
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle size={11} className="text-danger" />
              <p className="text-[10px] text-danger font-medium">Limit Exceeded</p>
            </div>
            <div className="flex items-center justify-between text-[10px] mb-0.5">
              <span className="text-danger/60">Exposure</span>
              <span className="text-danger font-mono tabular-nums">{risk.exposure_pct.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-danger/60">Allowed</span>
              <span className="text-amber-400 font-mono tabular-nums">{risk.max_capital_deployment.toFixed(1)}%</span>
            </div>
            {risk.risk_reject_count > 0 && (
              <div className="flex items-center justify-between text-[10px] mt-1 pt-1 border-t border-danger/10">
                <span className="text-danger/60">Rejected orders</span>
                <span className="text-danger font-mono tabular-nums">{risk.risk_reject_count}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
