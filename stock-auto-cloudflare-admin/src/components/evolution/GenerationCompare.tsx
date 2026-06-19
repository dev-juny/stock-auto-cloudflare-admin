import { useEffect, useState } from 'react'
import { api, type GenerationCompareResult, type EvolutionStrategy } from '../../utils/api'
import { X, TrendingUp, TrendingDown, Minus, Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface Props {
  genA: number
  genB: number
  onClose: () => void
}

export function GenerationCompare({ genA, genB, onClose }: Props) {
  const [result, setResult] = useState<GenerationCompareResult | null>(null)
  const [genAStrat, setGenAStrat] = useState<EvolutionStrategy[]>([])
  const [genBStrat, setGenBStrat] = useState<EvolutionStrategy[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [genA, genB])

  async function load() {
    setLoading(true)
    try {
      const [cmp, sa, sb] = await Promise.all([
        api.get<GenerationCompareResult>(`/api/evolution/generations/compare?gen_a=${genA}&gen_b=${genB}`),
        api.get<EvolutionStrategy[]>(`/api/evolution/generations/${genA}/strategies`),
        api.get<EvolutionStrategy[]>(`/api/evolution/generations/${genB}/strategies`),
      ])
      setResult(cmp)
      setGenAStrat(sa)
      setGenBStrat(sb)
    } catch {}
    setLoading(false)
  }

  function Delta({ val, suffix = '' }: { val: number; suffix?: string }) {
    const isPos = val > 0
    const isZero = val === 0
    return (
      <span className={`inline-flex items-center gap-0.5 font-medium ${isZero ? 'text-text-muted' : isPos ? 'text-green-400' : 'text-red-400'}`}>
        {isZero ? <Minus size={12} /> : isPos ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {isPos ? '+' : ''}{val.toFixed(2)}{suffix}
      </span>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-surface-card w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-surface-border">
          <h3 className="text-sm font-bold text-text">
            Gen {genA} <span className="text-text-muted mx-1">vs</span> Gen {genB}
          </h3>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading...</div>
        ) : !result ? (
          <div className="p-8 text-center text-xs text-text-muted">Failed to load comparison</div>
        ) : (
          <div className="overflow-y-auto flex-1 p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface rounded-xl p-4">
                <div className="text-[11px] font-semibold text-text-muted mb-3">Gen {genA}</div>
                <div className="space-y-2">
                  {[
                    { label: 'Strategies', value: result.gen_a.count },
                    { label: 'Avg Return', value: `${result.gen_a.avg_return >= 0 ? '+' : ''}${result.gen_a.avg_return.toFixed(2)}%` },
                    { label: 'Avg Win Rate', value: `${result.gen_a.avg_winrate.toFixed(1)}%` },
                    { label: 'Avg Fitness', value: result.gen_a.avg_fitness.toFixed(2) },
                    { label: 'Avg MDD', value: `${result.gen_a.avg_mdd.toFixed(2)}%` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-text-muted">{label}</span>
                      <span className="text-text font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-surface rounded-xl p-4">
                <div className="text-[11px] font-semibold text-text-muted mb-3">Gen {genB}</div>
                <div className="space-y-2">
                  {[
                    { label: 'Strategies', value: result.gen_b.count },
                    { label: 'Avg Return', value: `${result.gen_b.avg_return >= 0 ? '+' : ''}${result.gen_b.avg_return.toFixed(2)}%` },
                    { label: 'Avg Win Rate', value: `${result.gen_b.avg_winrate.toFixed(1)}%` },
                    { label: 'Avg Fitness', value: result.gen_b.avg_fitness.toFixed(2) },
                    { label: 'Avg MDD', value: `${result.gen_b.avg_mdd.toFixed(2)}%` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-text-muted">{label}</span>
                      <span className="text-text font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface rounded-xl p-4">
                <div className="flex items-center gap-1 text-xs text-green-400 font-medium mb-2">
                  <Plus size={14} /> New Entries: {result.new_entries}
                </div>
                <div className="flex items-center gap-1 text-xs text-red-400 font-medium">
                  <Minus size={14} /> Removed: {result.removed}
                </div>
              </div>
              <div className="bg-surface rounded-xl p-4">
                <div className="text-[11px] font-semibold text-text-muted mb-2">Performance Delta</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Return</span>
                    <Delta val={result.gen_b.avg_return - result.gen_a.avg_return} suffix="%" />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Win Rate</span>
                    <Delta val={result.gen_b.avg_winrate - result.gen_a.avg_winrate} suffix="%" />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Fitness</span>
                    <Delta val={result.gen_b.avg_fitness - result.gen_a.avg_fitness} />
                  </div>
                </div>
              </div>
            </div>

            {result.changed.length > 0 && (
              <div className="bg-surface rounded-xl p-4">
                <div className="text-[11px] font-semibold text-text-muted mb-3">Strategy Changes</div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {result.changed.map(c => (
                    <div key={c.strategy_id} className="flex items-center justify-between text-xs bg-surface-card rounded-lg px-3 py-2">
                      <span className="text-text font-medium truncate max-w-[120px]">{c.name}</span>
                      <div className="flex items-center gap-3">
                        <span><span className="text-text-muted mr-1">R:</span><Delta val={c.return_change} suffix="%" /></span>
                        <span><span className="text-text-muted mr-1">WR:</span><Delta val={c.winrate_change} suffix="%" /></span>
                        <span><span className="text-text-muted mr-1">F:</span><Delta val={c.fitness_change} /></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
