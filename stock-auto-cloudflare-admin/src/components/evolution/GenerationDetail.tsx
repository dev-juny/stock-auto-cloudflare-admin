import { useEffect, useState } from 'react'
import { api, type EvolutionStrategy } from '../../utils/api'
import { X, TrendingUp, TrendingDown, Percent, Activity, Hash, BarChart2 } from 'lucide-react'

interface Props {
  generation: number
  onClose: () => void
  onCompare: (gen: number) => void
}

export function GenerationDetail({ generation, onClose, onCompare }: Props) {
  const [strategies, setStrategies] = useState<EvolutionStrategy[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [generation])

  async function load() {
    setLoading(true)
    try {
      const data = await api.get<EvolutionStrategy[]>(`/api/evolution/generations/${generation}/strategies`)
      setStrategies(data || [])
    } catch {}
    setLoading(false)
  }

  const tested = strategies.filter(s => s.total_trades > 0)
  const avgRet = tested.length ? tested.reduce((a, s) => a + s.total_return, 0) / tested.length : 0
  const avgWr = tested.length ? tested.reduce((a, s) => a + s.win_rate, 0) / tested.length : 0
  const avgFitness = tested.length ? tested.reduce((a, s) => a + s.fitness_score, 0) / tested.length : 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-surface-card w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-surface-border">
          <h3 className="text-sm font-bold text-text">Generation {generation} — Strategies</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => onCompare(generation)}
              className="text-[11px] px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors">
              Compare
            </button>
            <button onClick={onClose} className="p-1 text-text-muted hover:text-text transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading...</div>
        ) : strategies.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted">No strategies in this generation</div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3 p-4 bg-surface/50">
              {[
                { label: 'Avg Return', value: avgRet, icon: TrendingUp, format: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, color: 'text-green-400' },
                { label: 'Avg Win Rate', value: avgWr, icon: Percent, format: (v: number) => `${v.toFixed(1)}%`, color: 'text-blue-400' },
                { label: 'Avg Fitness', value: avgFitness, icon: Activity, format: (v: number) => v.toFixed(2), color: 'text-amber-400' },
                { label: 'Count', value: strategies.length, icon: Hash, format: (v: number) => String(v), color: 'text-text-muted' },
              ].map(m => {
                const Icon = m.icon
                return (
                  <div key={m.label} className="bg-surface-card rounded-xl p-3">
                    <div className="flex items-center gap-1 text-[10px] text-text-muted mb-1">
                      <Icon size={10} /> {m.label}
                    </div>
                    <div className={`text-sm font-bold ${m.color}`}>{m.format(m.value)}</div>
                  </div>
                )
              })}
            </div>

            <div className="overflow-y-auto flex-1">
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
            </div>
          </>
        )}
      </div>
    </div>
  )
}
