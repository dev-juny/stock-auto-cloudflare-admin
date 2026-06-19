import { GitCommit, GitBranch, Users, BarChart3, ArrowUpDown, TrendingUp, Percent, TrendingDown } from 'lucide-react'
import type { GenerationSummary } from '../../utils/api'

interface Props {
  generations: GenerationSummary[]
}

export function EvolutionTimeline({ generations }: Props) {
  if (!generations || generations.length === 0) {
    return (
      <div className="bg-surface-card rounded-2xl p-6 border border-surface-border">
        <p className="text-xs text-text-muted text-center">No generations recorded yet</p>
      </div>
    )
  }

  const sorted = [...generations].reverse()

  return (
    <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
      <div className="p-3 border-b border-surface-border">
        <div className="flex items-center gap-1.5">
          <GitCommit size={14} className="text-primary" />
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Generation History</span>
        </div>
      </div>
      <div className="divide-y divide-surface-border">
        {sorted.map((g, idx) => (
          <div key={`${g.generation}-${idx}`} className="px-4 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                {g.generation}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-text-muted">
                <span>Population: {g.population_size}</span>
                <span>Elite: {g.elite_count}</span>
              </div>
              <span className="text-[10px] text-text-muted ml-auto">
                {g.created_at_kst || g.created_at}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              <Metric icon={BarChart3} label="Avg Fitness" value={g.avg_fitness.toFixed(2)} color="text-green-400" />
              <Metric icon={ArrowUpDown} label="Best Fitness" value={g.best_fitness.toFixed(2)} color="text-amber-400" />
              <Metric icon={TrendingUp} label="Avg Return" value={`${g.avg_return >= 0 ? '+' : ''}${g.avg_return.toFixed(2)}%`} color={g.avg_return >= 0 ? 'text-green-400' : 'text-red-400'} />
              <Metric icon={Percent} label="Avg Win Rate" value={`${g.avg_winrate.toFixed(1)}%`} color="text-blue-400" />
              <Metric icon={TrendingDown} label="Avg MDD" value={`${g.avg_mdd.toFixed(2)}%`} color="text-red-400" />
              <div className="flex items-center gap-1.5 bg-surface rounded-lg px-2 py-1.5">
                <GitBranch size={10} className="text-text-muted" />
                <div className="flex-1">
                  <div className="text-[9px] text-text-muted">Mutations / Crossovers</div>
                  <div className="text-[11px] font-semibold text-text-muted">{g.mutation_count} / {g.crossover_count}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Metric({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-surface rounded-lg px-2 py-1.5">
      <Icon size={10} className="text-text-muted" />
      <div>
        <div className="text-[9px] text-text-muted">{label}</div>
        <div className={`text-[11px] font-semibold ${color}`}>{value}</div>
      </div>
    </div>
  )
}
