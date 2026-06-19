import { Activity } from 'lucide-react'
import type { EvolutionStatus } from '../../utils/api'
import { formatKST } from '../../utils/kst'

interface Props {
  status: EvolutionStatus | null
  generationCount: number
  strategyCount: number
}

export function LiveStatus({ status, generationCount, strategyCount }: Props) {
  if (!status) {
    return (
      <div className="bg-surface-card rounded-2xl p-4 border border-surface-border">
        <p className="text-xs text-text-muted">Loading evolution status...</p>
      </div>
    )
  }

  const items = [
    { label: 'Generation', value: `#${status.current_generation}` },
    { label: 'Strategies', value: strategyCount.toString() },
    { label: 'Total Gens', value: generationCount.toString() },
    { label: 'Progress', value: status.is_running ? `${status.progress_pct}%` : '-' },
    { label: 'Last Run', value: status.last_run_at_kst || status.last_run_at || '-' },
    { label: 'Next Run', value: status.next_scheduled_run_kst || status.next_scheduled_run || '-' },
  ]

  return (
    <div className="bg-surface-card rounded-2xl p-4 border border-surface-border">
      <div className="flex items-center gap-1.5 mb-3">
        <Activity size={14} className="text-primary" />
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Live Status</span>
        {status.current_operation && (
          <span className="text-[10px] text-primary ml-1">{status.current_operation}</span>
        )}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {items.map((item) => (
          <div key={item.label}>
            <div className="text-[10px] text-text-muted mb-0.5">{item.label}</div>
            <div className="text-sm font-semibold text-text truncate">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
