import { Cpu, Play, Square, Clock, Users, TrendingUp } from 'lucide-react'
import { Card } from '../common/Card'
import { Badge } from '../common/Badge'
import { CardSkeleton } from '../common/Skeleton'
import { DashboardResponse } from '../../utils/api'

interface Props {
  dash: DashboardResponse | null
  loading: boolean
}

export function EvolutionCard({ dash, loading }: Props) {
  if (loading) return <CardSkeleton />

  const gen = dash?.generation
  if (!gen) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Cpu size={16} className="text-text-muted" />
          <h2 className="text-sm font-semibold text-text-primary">Evolution</h2>
        </div>
        <p className="text-xs text-text-muted">No evolution data</p>
      </Card>
    )
  }

  const isRunning = gen.status === 'RUNNING'

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-text-muted" />
          <h2 className="text-sm font-semibold text-text-primary">Evolution</h2>
        </div>
        <Badge variant={isRunning ? 'success' : 'info'}>
          {isRunning ? 'RUNNING' : gen.status}
        </Badge>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={13} className="text-text-muted" />
            <span className="text-xs text-text-muted">Generation</span>
          </div>
          <span className="text-sm font-semibold font-mono tabular-nums">{gen.current}</span>
        </div>

        {gen.population > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={13} className="text-text-muted" />
              <span className="text-xs text-text-muted">Population</span>
            </div>
            <span className="text-xs font-mono tabular-nums">{gen.population}</span>
          </div>
        )}

        {gen.last_run && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play size={13} className="text-text-muted" />
              <span className="text-xs text-text-muted">Last Run</span>
            </div>
            <span className="text-xs font-mono tabular-nums text-text-muted">{gen.last_run}</span>
          </div>
        )}

        {gen.next_scheduled && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-text-muted" />
              <span className="text-xs text-text-muted">Next</span>
            </div>
            <span className="text-xs font-mono tabular-nums text-text-muted">{gen.next_scheduled}</span>
          </div>
        )}
      </div>
    </Card>
  )
}
