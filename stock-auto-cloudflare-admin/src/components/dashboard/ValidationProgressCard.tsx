import { ClipboardCheck, Calendar, BarChart3, TrendingUp, TrendingDown, Target } from 'lucide-react'
import { Card } from '../common/Card'
import { Badge } from '../common/Badge'
import { CardSkeleton } from '../common/Skeleton'
import { DashboardResponse } from '../../utils/api'

interface Props {
  dash: DashboardResponse | null
  loading: boolean
}

export function ValidationProgressCard({ dash, loading }: Props) {
  if (loading) return <CardSkeleton />

  const val = dash?.validation
  const sys = dash?.system
  if (!val) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardCheck size={16} className="text-text-muted" />
          <h2 className="text-sm font-semibold text-text-primary">Validation</h2>
        </div>
        <p className="text-xs text-text-muted">No validation data</p>
      </Card>
    )
  }

  const progressPct = sys?.validation_progress_pct ?? (val.progress?.progress_pct as number) ?? 0
  const metrics = val.metrics as Record<string, unknown> ?? {}
  const advanced = val.advanced_metrics as Record<string, unknown> ?? {}

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={16} className="text-text-muted" />
          <h2 className="text-sm font-semibold text-text-primary">Validation</h2>
        </div>
        <Badge variant={val.active ? 'success' : 'muted'}>
          {val.active ? 'ACTIVE' : 'INACTIVE'}
        </Badge>
      </div>

      <div className="space-y-2.5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-muted">Progress</span>
            <span className="text-xs font-mono tabular-nums">{progressPct.toFixed(0)}%</span>
          </div>
          <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, progressPct)}%` }}
            />
          </div>
        </div>

        {val.started_at && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-text-muted" />
              <span className="text-xs text-text-muted">Started</span>
            </div>
            <span className="text-xs font-mono tabular-nums text-text-muted">{val.started_at}</span>
          </div>
        )}

        {typeof metrics.total_return === 'number' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={13} className="text-text-muted" />
              <span className="text-xs text-text-muted">Return</span>
            </div>
            <span className={`text-xs font-mono tabular-nums ${Number(metrics.total_return) >= 0 ? 'text-success' : 'text-danger'}`}>
              {Number(metrics.total_return).toFixed(2)}%
            </span>
          </div>
        )}

        {typeof metrics.sharpe_ratio === 'number' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={13} className="text-text-muted" />
              <span className="text-xs text-text-muted">Sharpe</span>
            </div>
            <span className="text-xs font-mono tabular-nums">{Number(metrics.sharpe_ratio).toFixed(2)}</span>
          </div>
        )}

        {typeof metrics.win_rate === 'number' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={13} className="text-text-muted" />
              <span className="text-xs text-text-muted">Win Rate</span>
            </div>
            <span className="text-xs font-mono tabular-nums">{Number(metrics.win_rate).toFixed(1)}%</span>
          </div>
        )}

        {typeof advanced.alpha === 'number' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={13} className="text-text-muted" />
              <span className="text-xs text-text-muted">Alpha</span>
            </div>
            <span className="text-xs font-mono tabular-nums">{Number(advanced.alpha).toFixed(4)}</span>
          </div>
        )}

        {typeof advanced.beta === 'number' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown size={13} className="text-text-muted" />
              <span className="text-xs text-text-muted">Beta</span>
            </div>
            <span className="text-xs font-mono tabular-nums">{Number(advanced.beta).toFixed(4)}</span>
          </div>
        )}
      </div>
    </Card>
  )
}
