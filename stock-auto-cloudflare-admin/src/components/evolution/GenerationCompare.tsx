import { useEffect, useState } from 'react'
import { api, type HistoryCompareResult, type EvolutionHolding } from '../../utils/api'
import { X, TrendingUp, TrendingDown, Minus, Plus, ArrowUpRight, ArrowDownRight, BarChart3, Percent, Activity, Hash, ArrowLeftRight } from 'lucide-react'

interface Props {
  genA: number
  genB: number
  onClose: () => void
}

export function GenerationCompare({ genA, genB, onClose }: Props) {
  const [result, setResult] = useState<HistoryCompareResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [genA, genB])

  async function load() {
    setLoading(true)
    try {
      const data = await api.post<HistoryCompareResult>('/api/evolution/history/compare', {
        generationIds: [genA, genB]
      })
      setResult(data)
    } catch (e) {
      console.error('Compare failed', e)
    }
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
      <div className="bg-surface-card w-full sm:max-w-4xl sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
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
                    { label: 'Fitness', value: result.gen_a.avg_fitness.toFixed(2) },
                    { label: 'Return', value: `${result.gen_a.avg_return >= 0 ? '+' : ''}${result.gen_a.avg_return.toFixed(2)}%` },
                    { label: 'Win Rate', value: `${result.gen_a.avg_winrate.toFixed(1)}%` },
                    { label: 'MDD', value: `${result.gen_a.avg_mdd.toFixed(2)}%` },
                    { label: 'Strategy Count', value: String(result.gen_a.count) },
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
                    { label: 'Fitness', value: result.gen_b.avg_fitness.toFixed(2) },
                    { label: 'Return', value: `${result.gen_b.avg_return >= 0 ? '+' : ''}${result.gen_b.avg_return.toFixed(2)}%` },
                    { label: 'Win Rate', value: `${result.gen_b.avg_winrate.toFixed(1)}%` },
                    { label: 'MDD', value: `${result.gen_b.avg_mdd.toFixed(2)}%` },
                    { label: 'Strategy Count', value: String(result.gen_b.count) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-text-muted">{label}</span>
                      <span className="text-text font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-surface rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <ArrowLeftRight size={12} className="text-primary" />
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Performance Delta</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-card rounded-lg p-3">
                  <div className="text-[10px] text-text-muted mb-1">Return</div>
                  <Delta val={result.gen_b.avg_return - result.gen_a.avg_return} suffix="%" />
                </div>
                <div className="bg-surface-card rounded-lg p-3">
                  <div className="text-[10px] text-text-muted mb-1">Win Rate</div>
                  <Delta val={result.gen_b.avg_winrate - result.gen_a.avg_winrate} suffix="%" />
                </div>
                <div className="bg-surface-card rounded-lg p-3">
                  <div className="text-[10px] text-text-muted mb-1">Fitness</div>
                  <Delta val={result.gen_b.avg_fitness - result.gen_a.avg_fitness} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.new_stocks.length > 0 && (
                <div className="bg-surface rounded-xl p-4">
                  <div className="flex items-center gap-1 text-xs text-green-400 font-medium mb-3">
                    <Plus size={14} /> New Entries ({result.new_stocks.length})
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {result.new_stocks.map(s => (
                      <div key={s.stock_code} className="flex items-center justify-between text-xs bg-surface-card rounded-lg px-3 py-2">
                        <div>
                          <span className="text-text font-medium">{s.stock_name}</span>
                          <span className="text-text-muted ml-1.5 font-mono">{s.stock_code}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted">→ {s.weight_after.toFixed(1)}%</span>
                          {s.return_after !== 0 && (
                            <span className={s.return_after >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {s.return_after >= 0 ? '+' : ''}{s.return_after.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.removed_stocks.length > 0 && (
                <div className="bg-surface rounded-xl p-4">
                  <div className="flex items-center gap-1 text-xs text-red-400 font-medium mb-3">
                    <Minus size={14} /> Removed ({result.removed_stocks.length})
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {result.removed_stocks.map(s => (
                      <div key={s.stock_code} className="flex items-center justify-between text-xs bg-surface-card rounded-lg px-3 py-2">
                        <div>
                          <span className="text-text font-medium">{s.stock_name}</span>
                          <span className="text-text-muted ml-1.5 font-mono">{s.stock_code}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted">{s.weight_before.toFixed(1)}% →</span>
                          {s.return_before !== 0 && (
                            <span className={s.return_before >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {s.return_before >= 0 ? '+' : ''}{s.return_before.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {result.changed_stocks.length > 0 && (
              <div className="bg-surface rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <BarChart3 size={12} className="text-primary" />
                  <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Weight & Return Changes ({result.changed_stocks.length})</span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {result.changed_stocks.map(s => (
                    <div key={s.stock_code} className="bg-surface-card rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-text font-medium">{s.stock_name}</span>
                          <span className="text-[10px] text-text-muted font-mono">{s.stock_code}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-text-muted">Weight:</span>
                          <span className="text-text font-medium">{s.weight_before.toFixed(1)}%</span>
                          <span className="text-text-muted text-[10px]">→</span>
                          <span className="text-text font-medium">{s.weight_after.toFixed(1)}%</span>
                          <Delta val={s.weight_after - s.weight_before} suffix="%" />
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-text-muted">Return:</span>
                          <span className={s.return_before >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {s.return_before >= 0 ? '+' : ''}{s.return_before.toFixed(2)}%
                          </span>
                          <span className="text-text-muted text-[10px]">→</span>
                          <span className={s.return_after >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {s.return_after >= 0 ? '+' : ''}{s.return_after.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.new_stocks.length === 0 && result.removed_stocks.length === 0 && result.changed_stocks.length === 0 && (
              <div className="p-6 text-center text-xs text-text-muted">No stock-level changes detected</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


