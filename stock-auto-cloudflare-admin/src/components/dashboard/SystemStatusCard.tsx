import { Clock, Database, Server, RefreshCw, Activity, AlertTriangle } from 'lucide-react'
import { Card } from '../common/Card'
import { Badge } from '../common/Badge'
import { CardSkeleton } from '../common/Skeleton'
import { DashboardResponse } from '../../utils/api'

interface SystemStatusCardProps {
  dash: DashboardResponse | null
  loading: boolean
  onRefresh: () => void
}

export function SystemStatusCard({ dash, loading, onRefresh }: SystemStatusCardProps) {
  if (loading) return <CardSkeleton />

  const sys = dash?.system
  const risk = dash?.risk

  const blocked = risk?.blocked ?? false
  const exposure = sys?.exposure_pct ?? 0
  const cashRatio = sys?.cash_ratio_pct ?? 0
  const openPositions = sys?.open_positions ?? 0
  const sellTrades = sys?.sell_trades ?? 0

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary">시스템 상태</h2>
        <button onClick={onRefresh} className="btn-ghost min-h-[36px] min-w-[36px] p-2">
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server size={14} className="text-text-muted" />
            <span className="text-xs text-text-muted">Risk Status</span>
          </div>
          <Badge variant={blocked ? 'danger' : risk?.status === 'PASS' ? 'success' : 'warning'}>
            {blocked ? 'BLOCKED' : risk?.status ?? 'UNKNOWN'}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-text-muted" />
            <span className="text-xs text-text-muted">Exposure</span>
          </div>
          <span className={`text-xs font-mono tabular-nums ${exposure > 90 ? 'text-danger' : exposure > 70 ? 'text-warning' : 'text-text-primary'}`}>
            {exposure.toFixed(1)}%
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-text-muted" />
            <span className="text-xs text-text-muted">Cash Ratio</span>
          </div>
          <span className={`text-xs font-mono tabular-nums ${cashRatio < 10 ? 'text-danger' : 'text-text-primary'}`}>
            {cashRatio.toFixed(1)}%
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-text-muted" />
            <span className="text-xs text-text-muted">Open Positions</span>
          </div>
          <span className="text-xs font-mono tabular-nums text-text-primary">{openPositions}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-text-muted" />
            <span className="text-xs text-text-muted">Sell Trades</span>
          </div>
          <span className="text-xs font-mono tabular-nums text-text-primary">{sellTrades}</span>
        </div>
      </div>
    </Card>
  )
}
