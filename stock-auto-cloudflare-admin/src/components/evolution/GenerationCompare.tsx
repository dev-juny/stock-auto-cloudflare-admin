import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { api, type HistoryCompareResult } from '../../utils/api'
import { X, Minus, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Plus } from 'lucide-react'

interface Props {
  genA: number
  genB: number
  onClose: () => void
}

function CompareContent({ genA, genB, onClose }: Props) {
  const [result, setResult] = useState<HistoryCompareResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [genA, genB])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await api.post<HistoryCompareResult>('/api/evolution/history/compare', {
        generationIds: [genA, genB],
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
        {isPos ? '+' : ''}{(val ?? 0).toFixed(2)}{suffix}
      </span>
    )
  }

  const universe = result?.universe

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
              {[result.gen_a, result.gen_b].filter((g): g is typeof result.gen_a => !!g).map(gen => (
                <div key={gen.generation} className="bg-surface rounded-xl p-4">
                  <div className="text-[11px] font-semibold text-text-muted mb-3">Gen {gen.generation}</div>
                  <div className="space-y-2">
                    {[
                      { label: 'Fitness', value: (gen.avg_fitness ?? 0).toFixed(2) },
                      { label: 'Return', value: `${(gen.avg_return ?? 0) >= 0 ? '+' : ''}${(gen.avg_return ?? 0).toFixed(2)}%` },
                      { label: 'Win Rate', value: `${(gen.avg_winrate ?? 0).toFixed(1)}%` },
                      { label: 'MDD', value: `${(gen.avg_mdd ?? 0).toFixed(2)}%` },
                      { label: 'Strategies', value: String(gen.count) },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-text-muted">{label}</span>
                        <span className="text-text font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-surface rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <ArrowLeftRight size={12} className="text-primary" />
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Performance Delta</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-card rounded-lg p-3">
                  <div className="text-[10px] text-text-muted mb-1">Return</div>
                  <Delta val={(result.gen_b?.avg_return ?? 0) - (result.gen_a?.avg_return ?? 0)} suffix="%" />
                </div>
                <div className="bg-surface-card rounded-lg p-3">
                  <div className="text-[10px] text-text-muted mb-1">Win Rate</div>
                  <Delta val={(result.gen_b?.avg_winrate ?? 0) - (result.gen_a?.avg_winrate ?? 0)} suffix="%" />
                </div>
                <div className="bg-surface-card rounded-lg p-3">
                  <div className="text-[10px] text-text-muted mb-1">Fitness</div>
                  <Delta val={(result.gen_b?.avg_fitness ?? 0) - (result.gen_a?.avg_fitness ?? 0)} />
                </div>
              </div>
            </div>

            <div className="bg-surface rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <ArrowLeftRight size={12} className="text-primary" />
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Evaluation Universe Delta</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-surface-card rounded-lg p-3">
                  <div className="text-[10px] text-text-muted mb-1">Gen {genA}</div>
                  <div className="text-xs font-bold text-text">{universe?.gen_a_count ?? 0}</div>
                </div>
                <div className="bg-surface-card rounded-lg p-3">
                  <div className="text-[10px] text-text-muted mb-1">Common</div>
                  <div className="text-xs font-bold text-primary">{universe?.common_count ?? 0}</div>
                </div>
                <div className="bg-surface-card rounded-lg p-3">
                  <div className="text-[10px] text-text-muted mb-1">Gen {genB}</div>
                  <div className="text-xs font-bold text-text">{universe?.gen_b_count ?? 0}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <UniverseList
                  title={`Only in Gen ${genB}`}
                  icon={<Plus size={14} />}
                  color="text-green-400"
                  stocks={universe?.added || []}
                />
                <UniverseList
                  title={`Only in Gen ${genA}`}
                  icon={<Minus size={14} />}
                  color="text-red-400"
                  stocks={universe?.removed || []}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function GenerationCompare(props: Props) {
  return createPortal(<CompareContent {...props} />, document.body)
}

function UniverseList({
  title,
  icon,
  color,
  stocks,
}: {
  title: string
  icon: ReactNode
  color: string
  stocks: Array<{ ticker: string; name: string; market?: string }>
}) {
  return (
    <div>
      <div className={`flex items-center gap-1 text-xs font-medium mb-3 ${color}`}>
        {icon} {title} ({stocks.length})
      </div>
      {stocks.length === 0 ? (
        <div className="p-4 text-center text-xs text-text-muted bg-surface-card rounded-lg">No differences</div>
      ) : (
        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {stocks.map(stock => (
            <div key={stock.ticker} className="flex items-center justify-between text-xs bg-surface-card rounded-lg px-3 py-2">
              <div>
                <span className="text-text font-medium">{stock.name}</span>
                <span className="text-text-muted ml-1.5 font-mono">{stock.ticker}</span>
              </div>
              <span className="text-text-muted">{stock.market || '-'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
