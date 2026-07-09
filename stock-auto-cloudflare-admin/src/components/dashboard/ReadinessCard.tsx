import { Rocket, CheckCircle, XCircle, AlertTriangle, ListChecks } from 'lucide-react'
import { Card } from '../common/Card'
import { Badge } from '../common/Badge'
import { CardSkeleton } from '../common/Skeleton'
import { DashboardResponse } from '../../utils/api'

interface Props {
  dash: DashboardResponse | null
  loading: boolean
}

const gradeColors: Record<string, 'success' | 'warning' | 'danger'> = {
  PASS: 'success',
  WATCH: 'warning',
  FAIL: 'danger',
}

export function ReadinessCard({ dash, loading }: Props) {
  if (loading) return <CardSkeleton />

  const r = dash?.readiness
  if (!r) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Rocket size={16} className="text-text-muted" />
          <h2 className="text-sm font-semibold text-text-primary">Readiness</h2>
        </div>
        <p className="text-xs text-text-muted">No readiness data</p>
      </Card>
    )
  }

  const color = gradeColors[r.grade] || 'danger'

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Rocket size={16} className="text-text-muted" />
          <h2 className="text-sm font-semibold text-text-primary">Readiness</h2>
        </div>
        <Badge variant={color}>{r.grade}</Badge>
      </div>

      <div className="space-y-2.5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-muted">Score</span>
            <span className={`text-xs font-mono tabular-nums ${r.score >= 80 ? 'text-success' : r.score >= 50 ? 'text-warning' : 'text-danger'}`}>
              {r.score}/100
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                r.score >= 80 ? 'bg-success' : r.score >= 50 ? 'bg-warning' : 'bg-danger'
              }`}
              style={{ width: `${Math.min(100, r.score)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks size={13} className="text-text-muted" />
            <span className="text-xs text-text-muted">Checks</span>
          </div>
          <span className="text-xs font-mono tabular-nums">{r.passed}/{r.total}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle size={13} className="text-text-muted" />
            <span className="text-xs text-text-muted">Verdict</span>
          </div>
          <Badge variant={r.verdict === 'PASS' ? 'success' : 'warning'}>{r.verdict}</Badge>
        </div>
      </div>
    </Card>
  )
}
