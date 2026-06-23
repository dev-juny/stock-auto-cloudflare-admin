import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { api, type EvolutionStrategy, type GenerationHistory } from '../../utils/api'
import { X, TrendingUp, Percent, Activity, Target } from 'lucide-react'

interface Props {
  generation: number
  onClose: () => void
}

function ModalContent({ generation, onClose }: Props) {
  const [tab, setTab] = useState<'universe' | 'strategies'>('universe')
  const [strategies, setStrategies] = useState<EvolutionStrategy[]>([])
  const [history, setHistory] = useState<GenerationHistory | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [generation])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [stratData, histData] = await Promise.all([
        api.get<EvolutionStrategy[]>(`/api/evolution/generations/${generation}/strategies`),
        api.get<GenerationHistory>(`/api/evolution/history/${generation}`),
      ])
      setStrategies(stratData || [])
      setHistory(histData)
    } catch {}
    setLoading(false)
  }

  const tested = strategies.filter(s => s.total_trades > 0)
  const avgRet = tested.length ? tested.reduce((a, s) => a + s.total_return, 0) / tested.length : 0
  const avgWr = tested.length ? tested.reduce((a, s) => a + s.win_rate, 0) / tested.length : 0
  const avgFitness = tested.length ? tested.reduce((a, s) => a + s.fitness_score, 0) / tested.length : 0
  const universe = history?.evaluation_universe || []

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-surface-card w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-surface-border">
          <div>
            <h3 className="text-sm font-bold text-text">Generation {generation}</h3>
            <span className="text-[10px] text-text-muted">
              {universe.length} evaluation stocks | {strategies.length} strategies
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 p-3 bg-surface/50">
              {[
                { label: 'Return', value: `${avgRet >= 0 ? '+' : ''}${avgRet.toFixed(2)}%`, icon: TrendingUp, color: avgRet >= 0 ? 'text-green-400' : 'text-red-400' },
                { label: 'Win Rate', value: `${avgWr.toFixed(1)}%`, icon: Percent, color: 'text-blue-400' },
                { label: 'Fitness', value: avgFitness.toFixed(2), icon: Activity, color: 'text-amber-400' },
                { label: 'Universe', value: String(universe.length), icon: Target, color: 'text-primary' },
              ].map(m => {
                const Icon = m.icon
                return (
                  <div key={m.label} className="bg-surface-card rounded-xl p-2.5">
                    <div className="flex items-center gap-1 text-[9px] text-text-muted mb-0.5">
                      <Icon size={9} /> {m.label}
                    </div>
                    <div className={`text-xs font-bold ${m.color}`}>{m.value}</div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2 px-4 border-b border-surface-border">
              {[
                { id: 'universe', label: 'Evaluation Universe', count: universe.length },
                { id: 'strategies', label: 'Strategies', count: strategies.length },
              ].map(t => {
                const isActive = tab === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id as 'universe' | 'strategies')}
                    className={`relative h-9 text-xs font-medium whitespace-nowrap transition-colors px-1 ${
                      isActive
                        ? 'text-text'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    {t.label}
                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-primary/15 text-primary' : 'bg-surface text-text-muted'
                    }`}>{t.count}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="overflow-y-auto flex-1">
              {tab === 'universe' && (
                <div className="p-3">
                  <div className="bg-surface rounded-xl overflow-hidden">
                    <div className="px-3 py-2 border-b border-surface-border flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Evaluation Universe</span>
                      <span className="text-[10px] text-text-muted">Shared by all strategies in this generation</span>
                    </div>
                    {universe.length === 0 ? (
                      <div className="p-6 text-center text-xs text-text-muted">No evaluation universe recorded</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-text-muted border-b border-surface-border">
                              <th className="text-right px-3 py-1.5 font-medium">#</th>
                              <th className="text-left px-3 py-1.5 font-medium">Stock</th>
                              <th className="text-left px-2 py-1.5 font-medium">Market</th>
                              <th className="text-left px-2 py-1.5 font-medium">Source</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-border">
                            {universe.map(stock => (
                              <tr key={stock.ticker} className="hover:bg-surface/50 transition-colors">
                                <td className="px-3 py-1.5 text-right text-text-muted font-mono">{stock.sample_order}</td>
                                <td className="px-3 py-1.5">
                                  <div className="text-text font-medium">{stock.name}</div>
                                  <div className="text-[9px] text-text-muted font-mono">{stock.ticker}</div>
                                </td>
                                <td className="px-2 py-1.5 text-text-muted">{stock.market || '-'}</td>
                                <td className="px-2 py-1.5 text-text-muted">{stock.selection_source}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === 'strategies' && (
                <div>
                  {strategies.length === 0 ? (
                    <div className="p-6 text-center text-xs text-text-muted">No strategies</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-surface-card">
                        <tr className="text-text-muted border-b border-surface-border">
                          <th className="text-left px-4 py-2 font-medium">Name</th>
                          <th className="text-right px-2 py-2 font-medium">Fitness</th>
                          <th className="text-right px-2 py-2 font-medium">Return</th>
                          <th className="text-right px-2 py-2 font-medium">Win Rate</th>
                          <th className="text-right px-2 py-2 font-medium">MDD</th>
                          <th className="text-right px-2 py-2 font-medium">Trades</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-border">
                        {strategies.map(s => (
                          <tr key={s.id} className="hover:bg-surface/50 transition-colors">
                            <td className="px-4 py-2 text-text font-medium">{s.name}</td>
                            <td className="px-2 py-2 text-right text-amber-400">{s.fitness_score.toFixed(2)}</td>
                            <td className={`px-2 py-2 text-right ${s.total_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {s.total_return >= 0 ? '+' : ''}{s.total_return.toFixed(2)}%
                            </td>
                            <td className="px-2 py-2 text-right text-blue-400">{s.win_rate.toFixed(1)}%</td>
                            <td className="px-2 py-2 text-right text-red-400">{s.max_drawdown.toFixed(2)}%</td>
                            <td className="px-2 py-2 text-right text-text-muted">{s.total_trades}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function GenerationDetail({ generation, onClose }: Props) {
  return createPortal(
    <ModalContent generation={generation} onClose={onClose} />,
    document.body
  )
}
