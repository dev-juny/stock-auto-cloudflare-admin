import { useState } from 'react'
import { Search, ShieldCheck, TrendingUp, TrendingDown, Activity, ChevronRight, Zap } from 'lucide-react'
import type { EvolutionStrategy } from '../../utils/api'

interface Props {
  strategies: EvolutionStrategy[]
  onSelect: (s: EvolutionStrategy) => void
}

export function StrategyPool({ strategies, onSelect }: Props) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? strategies.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    : strategies

  const entryIcon = (type: string) => {
    switch (type) {
      case 'momentum': return <Zap size={14} className="text-blue-400" />
      case 'breakout': return <TrendingUp size={14} className="text-green-400" />
      case 'pullback': return <TrendingDown size={14} className="text-orange-400" />
      default: return <Activity size={14} className="text-purple-400" />
    }
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
      <div className="p-3 border-b border-surface-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search strategies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-surface rounded-lg text-sm text-text placeholder:text-text-muted border border-surface-border focus:outline-none focus:border-primary"
          />
        </div>
      </div>
      <div className="divide-y divide-surface-border max-h-[60vh] overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-text-muted">No strategies found</div>
        )}
        {filtered.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface/50 transition-colors"
          >
            {s.is_elite && <ShieldCheck size={16} className="text-amber-400 shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {entryIcon(s.params?.entry_type)}
                <span className="text-sm font-medium text-text truncate">{s.name}</span>
                {s.is_elite && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium shrink-0">ELITE</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-text-muted">G{s.generation}</span>
                <span className="text-[10px] text-text-muted">v{s.version}</span>
                {s.total_trades > 0 && (
                  <>
                    <span className={`text-[10px] font-medium ${s.total_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {s.total_return >= 0 ? '+' : ''}{s.total_return.toFixed(2)}%
                    </span>
                    <span className={`text-[10px] font-medium ${s.win_rate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                      {s.win_rate.toFixed(1)}%
                    </span>
                  </>
                )}
                <span className="text-[10px] text-text-muted">{s.tags?.slice(0, 2).join(', ')}</span>
              </div>
            </div>
            <ChevronRight size={14} className="text-text-muted shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}
