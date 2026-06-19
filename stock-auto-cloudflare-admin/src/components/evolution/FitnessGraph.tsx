import { BarChart2, TrendingUp, TrendingDown, Activity, Percent } from 'lucide-react'
import type { GenerationSummary } from '../../utils/api'

interface Props {
  generations: GenerationSummary[]
  onGenClick?: (gen: number) => void
}

export function FitnessGraph({ generations, onGenClick }: Props) {
  if (!generations || generations.length === 0) {
    return (
      <div className="bg-surface-card rounded-2xl p-6 border border-surface-border">
        <p className="text-xs text-text-muted text-center">No generation data yet</p>
      </div>
    )
  }

  const sorted = [...generations].reverse()
  const maxFitness = Math.max(...sorted.map(g => g.best_fitness), 1)

  return (
    <div className="bg-surface-card rounded-2xl p-4 border border-surface-border">
      <div className="flex items-center gap-1.5 mb-4">
        <BarChart2 size={14} className="text-primary" />
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Fitness & Performance</span>
      </div>
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-text-muted flex items-center gap-1">
              <Activity size={10} /> Best Fitness
            </span>
            <span className="text-[10px] text-text-muted">{sorted[sorted.length - 1]?.best_fitness.toFixed(2)}</span>
          </div>
          <div className="flex items-end gap-0.5 h-16">
            {sorted.map((g, idx) => (
              <div
                key={`${g.generation}-${idx}`}
                className="flex-1 rounded-t-sm transition-all cursor-pointer hover:opacity-100"
                style={{
                  height: `${(g.best_fitness / maxFitness) * 100}%`,
                  backgroundColor: g.best_fitness >= 0 ? 'rgb(34 197 94)' : 'rgb(239 68 68)',
                  opacity: 0.7,
                }}
                title={`Gen ${g.generation}: ${g.best_fitness.toFixed(2)}`}
                onClick={() => onGenClick?.(g.generation)}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Avg Return', icon: TrendingUp, value: sorted[sorted.length - 1]?.avg_return, format: 'percent', color: 'text-green-400' },
            { label: 'Avg Win Rate', icon: Percent, value: sorted[sorted.length - 1]?.avg_winrate, format: 'percent', color: 'text-blue-400' },
            { label: 'Avg MDD', icon: TrendingDown, value: sorted[sorted.length - 1]?.avg_mdd, format: 'percent', color: 'text-red-400' },
            { label: 'Best Fitness', icon: Activity, value: sorted[sorted.length - 1]?.best_fitness, format: 'number', color: 'text-amber-400' },
          ].map((metric) => {
            const Icon = metric.icon
            const val = typeof metric.value === 'number' ? metric.value : 0
            const display = metric.format === 'percent' ? `${val >= 0 ? '+' : ''}${val.toFixed(2)}%` : val.toFixed(2)
            return (
              <div key={metric.label} className="bg-surface rounded-xl p-3">
                <div className="flex items-center gap-1 text-[10px] text-text-muted mb-1">
                  <Icon size={10} />
                  {metric.label}
                </div>
                <div className={`text-sm font-bold ${metric.color}`}>{display}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
