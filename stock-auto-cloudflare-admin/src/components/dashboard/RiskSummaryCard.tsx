import { ShieldAlert, AlertTriangle, Ban, DollarSign, Percent } from 'lucide-react'
import { Card } from '../common/Card'
import { Badge } from '../common/Badge'
import { CardSkeleton } from '../common/Skeleton'
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

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className={blocked ? 'text-danger' : 'text-text-muted'} />
          <h2 className="text-sm font-semibold text-text-primary">Risk</h2>
        </div>
        <Badge variant={blocked ? 'danger' : risk.status === 'PASS' ? 'success' : 'warning'}>
          {blocked ? 'BLOCKED' : risk.status}
        </Badge>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Percent size={13} className="text-text-muted" />
            <span className="text-xs text-text-muted">Exposure</span>
          </div>
          <span className={`text-xs font-mono tabular-nums ${exposure > 90 ? 'text-danger' : 'text-text-primary'}`}>
            {exposure.toFixed(1)}%
          </span>
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

        {blocked && risk.reasons.length > 0 && (
          <div className="mt-2 p-2 bg-danger/10 rounded-lg">
            <p className="text-[10px] text-danger font-medium mb-1">Blocked Reasons:</p>
            {risk.reasons.map((r, i) => (
              <p key={i} className="text-[10px] text-danger/80">{r}</p>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
