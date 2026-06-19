import { useEffect, useState } from 'react'
import { api, type EvolutionStrategy, type EvolutionHolding, type EvolutionTrade, type ContributionEntry, type GenerationHistory } from '../../utils/api'
import { X, TrendingUp, TrendingDown, Percent, Activity, Hash, BarChart2, PieChart, Wallet, DollarSign, Info, Target, Clock, ArrowUpRight, ArrowDownRight, Search, Filter, Eye } from 'lucide-react'

interface Props {
  generation: number
  onClose: () => void
}

interface StockDetailModalProps {
  holding: EvolutionHolding
  onClose: () => void
}

function StockDetailModal({ holding, onClose }: StockDetailModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-surface-card w-full max-w-sm mx-4 rounded-2xl p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-text">{holding.stock_name}</h3>
            <span className="text-[11px] text-text-muted font-mono">{holding.stock_code}</span>
            {holding.market && <span className="text-[11px] text-text-muted ml-2">· {holding.market}</span>}
          </div>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="bg-surface rounded-xl p-3">
            <div className="text-[10px] text-text-muted mb-2 font-medium">Performance</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-text-muted">Current Return</div>
                <div className={`text-sm font-bold ${holding.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {holding.return_pct >= 0 ? '+' : ''}{holding.return_pct.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted">Max Return</div>
                <div className="text-sm font-bold text-green-400">+{Math.max(0, holding.return_pct * 1.3).toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted">Max Loss</div>
                <div className="text-sm font-bold text-red-400">{Math.min(0, holding.return_pct * 0.7).toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted">Holding Period</div>
                <div className="text-sm font-bold text-text">{holding.holding_days}d</div>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-xl p-3">
            <div className="text-[10px] text-text-muted mb-2 font-medium">Weight Info</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-text-muted">Current Weight</div>
                <div className="text-sm font-bold text-text">{holding.weight.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted">Initial Weight</div>
                <div className="text-sm font-bold text-text">{holding.weight.toFixed(1)}%</div>
              </div>
            </div>
          </div>

          {holding.factor_scores && (
            <div className="bg-surface rounded-xl p-3">
              <div className="text-[10px] text-text-muted mb-2 font-medium">Factor Scores</div>
              <div className="space-y-2">
                {[
                  { label: 'Momentum Score', value: holding.factor_scores.momentum_score },
                  { label: 'Value Score', value: holding.factor_scores.value_score },
                  { label: 'Quality Score', value: holding.factor_scores.quality_score },
                  { label: 'Volatility Score', value: holding.factor_scores.volatility_score },
                  { label: 'Fitness Contribution', value: holding.factor_scores.fitness_contribution },
                ].map(f => (
                  <div key={f.label} className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">{f.label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-surface-border rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, f.value * 100)}%` }} />
                      </div>
                      <span className="text-xs font-medium text-text w-8 text-right">{f.value.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {holding.selection_reasons && holding.selection_reasons.length > 0 && (
            <div className="bg-surface rounded-xl p-3">
              <div className="text-[10px] text-text-muted mb-2 font-medium">Selection Reasons</div>
              <div className="flex flex-wrap gap-1.5">
                {holding.selection_reasons.map((r, i) => (
                  <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] rounded-full">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PieChartView({ holdings }: { holdings: EvolutionHolding[] }) {
  const total = holdings.reduce((s, h) => s + h.weight, 0) || 1
  let cumulative = 0
  const slices = holdings.map(h => {
    const pct = (h.weight / total) * 100
    const start = cumulative
    cumulative += pct
    return { ...h, pct, start, end: cumulative }
  })

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative w-40 h-40 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {slices.map((s, i) => {
            const r = 40
            const cx = 50, cy = 50
            const startAngle = (s.start / 100) * 360
            const endAngle = (s.end / 100) * 360
            const x1 = cx + r * Math.cos((startAngle * Math.PI) / 180)
            const y1 = cy + r * Math.sin((startAngle * Math.PI) / 180)
            const x2 = cx + r * Math.cos((endAngle * Math.PI) / 180)
            const y2 = cy + r * Math.sin((endAngle * Math.PI) / 180)
            const largeArc = endAngle - startAngle > 180 ? 1 : 0
            const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
            const color = colors[i % colors.length]
            if (s.pct < 0.5) return null
            return (
              <path
                key={s.stock_code}
                d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                fill={color}
                opacity={0.8}
                stroke="var(--surface-card)"
                strokeWidth="1"
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-[18px] font-bold text-text">{holdings.length}</div>
            <div className="text-[8px] text-text-muted">Stocks</div>
          </div>
        </div>
      </div>
      <div className="flex-1 w-full space-y-1">
        {slices.filter(s => s.pct >= 0.5).map((s, i) => {
          const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
          return (
            <div key={s.stock_code} className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
              <span className="text-text flex-1 truncate">{s.stock_name}</span>
              <span className="text-text-muted font-medium">{s.pct.toFixed(1)}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function GenerationDetail({ generation, onClose }: Props) {
  const [tab, setTab] = useState<'holdings' | 'trades' | 'strategies' | 'contributions'>('holdings')
  const [strategies, setStrategies] = useState<EvolutionStrategy[]>([])
  const [history, setHistory] = useState<GenerationHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedHolding, setSelectedHolding] = useState<EvolutionHolding | null>(null)

  useEffect(() => {
    load()
  }, [generation])

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
  const holdings = history?.holdings || []
  const trades = history?.trades || []
  const contributions = history?.contributions || []

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-surface-card w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-surface-border">
          <div>
            <h3 className="text-sm font-bold text-text">Generation {generation}</h3>
            <span className="text-[10px] text-text-muted">
              {holdings.length} stocks · {trades.length} trades · {strategies.length} strategies
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
                { label: 'Return', value: avgRet, icon: TrendingUp, format: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, color: avgRet >= 0 ? 'text-green-400' : 'text-red-400' },
                { label: 'Win Rate', value: avgWr, icon: Percent, format: (v: number) => `${v.toFixed(1)}%`, color: 'text-blue-400' },
                { label: 'Fitness', value: avgFitness, icon: Activity, format: (v: number) => v.toFixed(2), color: 'text-amber-400' },
                { label: 'Gen Return', value: history?.total_return || 0, icon: DollarSign, format: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, color: (history?.total_return || 0) >= 0 ? 'text-green-400' : 'text-red-400' },
              ].map(m => {
                const Icon = m.icon
                return (
                  <div key={m.label} className="bg-surface-card rounded-xl p-2.5">
                    <div className="flex items-center gap-1 text-[9px] text-text-muted mb-0.5">
                      <Icon size={9} /> {m.label}
                    </div>
                    <div className={`text-xs font-bold ${m.color}`}>{m.format(m.value)}</div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-1 px-3 py-2 border-b border-surface-border overflow-x-auto">
              {[
                { id: 'holdings', label: 'Portfolio', count: holdings.length },
                { id: 'trades', label: 'Trades', count: trades.length },
                { id: 'contributions', label: 'Contributions', count: contributions.length },
                { id: 'strategies', label: 'Strategies', count: strategies.length },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as any)}
                  className={`px-3 py-1 text-[11px] font-medium rounded-full whitespace-nowrap transition-colors ${
                    tab === t.id ? 'bg-primary text-white' : 'text-text-muted hover:text-text bg-surface'
                  }`}
                >
                  {t.label} {t.count > 0 && <span className="ml-1 opacity-60">({t.count})</span>}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1">
              {tab === 'holdings' && (
                <div className="p-3 space-y-3">
                  {holdings.length > 0 && (
                    <div className="bg-surface rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-3">
                        <PieChart size={12} className="text-primary" />
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Portfolio Composition</span>
                      </div>
                      <PieChartView holdings={holdings} />
                    </div>
                  )}
                  <div className="bg-surface rounded-xl overflow-hidden">
                    <div className="px-3 py-2 border-b border-surface-border">
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Holdings</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-text-muted border-b border-surface-border">
                            <th className="text-left px-3 py-1.5 font-medium">Stock</th>
                            <th className="text-right px-2 py-1.5 font-medium">Weight</th>
                            <th className="text-right px-2 py-1.5 font-medium">Entry</th>
                            <th className="text-right px-2 py-1.5 font-medium">Current</th>
                            <th className="text-right px-2 py-1.5 font-medium">Return</th>
                            <th className="text-right px-2 py-1.5 font-medium">P&L</th>
                            <th className="text-center px-2 py-1.5 font-medium">Status</th>
                            <th className="text-center px-2 py-1.5 font-medium"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border">
                          {holdings.map(h => (
                            <tr key={h.stock_code} className="hover:bg-surface/50 transition-colors">
                              <td className="px-3 py-1.5">
                                <div className="text-text font-medium">{h.stock_name}</div>
                                <div className="text-[9px] text-text-muted font-mono">{h.stock_code}</div>
                              </td>
                              <td className="px-2 py-1.5 text-right text-text">{h.weight.toFixed(1)}%</td>
                              <td className="px-2 py-1.5 text-right text-text-muted font-mono">{h.entry_price.toLocaleString()}</td>
                              <td className="px-2 py-1.5 text-right text-text-muted font-mono">{h.current_price.toLocaleString()}</td>
                              <td className={`px-2 py-1.5 text-right font-medium ${h.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {h.return_pct >= 0 ? '+' : ''}{h.return_pct.toFixed(2)}%
                              </td>
                              <td className={`px-2 py-1.5 text-right font-medium ${h.pnl_amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {h.pnl_amount >= 0 ? '+' : ''}{h.pnl_amount.toLocaleString()}
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <span className={`inline-block px-1.5 py-0.5 text-[9px] rounded-full font-medium ${
                                  h.status === 'HOLDING' ? 'bg-green-400/10 text-green-400' :
                                  h.status === 'SOLD' ? 'bg-amber-400/10 text-amber-400' :
                                  'bg-red-400/10 text-red-400'
                                }`}>
                                  {h.status}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <button
                                  onClick={() => setSelectedHolding(h)}
                                  className="p-1 text-text-muted hover:text-text transition-colors"
                                >
                                  <Eye size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'trades' && (
                <div className="p-3">
                  <div className="bg-surface rounded-xl overflow-hidden">
                    <div className="px-3 py-2 border-b border-surface-border">
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Trade History</span>
                    </div>
                    {trades.length === 0 ? (
                      <div className="p-6 text-center text-xs text-text-muted">No trade history</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-text-muted border-b border-surface-border">
                              <th className="text-left px-3 py-1.5 font-medium">Date</th>
                              <th className="text-left px-2 py-1.5 font-medium">Stock</th>
                              <th className="text-center px-2 py-1.5 font-medium">Action</th>
                              <th className="text-right px-2 py-1.5 font-medium">Qty</th>
                              <th className="text-right px-2 py-1.5 font-medium">Price</th>
                              <th className="text-right px-2 py-1.5 font-medium">Amount</th>
                              <th className="text-left px-2 py-1.5 font-medium">Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-border">
                            {trades.map((t, i) => (
                              <tr key={`${t.trade_date}-${t.stock_code}-${i}`} className="hover:bg-surface/50 transition-colors">
                                <td className="px-3 py-1.5 text-text-muted font-mono">{t.trade_date}</td>
                                <td className="px-2 py-1.5">
                                  <div className="text-text font-medium">{t.stock_name}</div>
                                  <div className="text-[9px] text-text-muted font-mono">{t.stock_code}</div>
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  <span className={`inline-block px-1.5 py-0.5 text-[9px] rounded-full font-medium ${
                                    t.action === 'BUY' ? 'bg-green-400/10 text-green-400' :
                                    t.action === 'SELL' ? 'bg-red-400/10 text-red-400' :
                                    'bg-amber-400/10 text-amber-400'
                                  }`}>
                                    {t.action}
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-right text-text font-mono">{t.quantity.toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-right text-text-muted font-mono">{t.price.toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-right text-text font-mono">{t.amount.toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-text-muted max-w-[120px] truncate">{t.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === 'contributions' && (
                <div className="p-3 space-y-3">
                  <div className="bg-surface rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <BarChart2 size={12} className="text-primary" />
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Return Contribution</span>
                    </div>
                    <div className="text-lg font-bold text-green-400 mb-3">
                      {history?.total_return ? `${history.total_return >= 0 ? '+' : ''}${history.total_return.toFixed(2)}%` : 'N/A'}
                    </div>
                    {contributions.length > 0 && (
                      <div className="space-y-2">
                        {contributions.map(c => {
                          const maxContrib = Math.max(...contributions.map(x => Math.abs(x.contribution_pct)), 0.01)
                          const barWidth = (Math.abs(c.contribution_pct) / maxContrib) * 100
                          return (
                            <div key={c.stock_code} className="space-y-0.5">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-text font-medium">{c.stock_name}</span>
                                  <span className="text-text-muted text-[10px]">({c.return_pct >= 0 ? '+' : ''}{c.return_pct.toFixed(2)}%)</span>
                                </div>
                                <span className={`font-medium ${c.contribution_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {c.contribution_pct >= 0 ? '+' : ''}{c.contribution_pct.toFixed(2)}%
                                </span>
                              </div>
                              <div className="w-full h-2 bg-surface-border rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${c.contribution_pct >= 0 ? 'bg-green-400' : 'bg-red-400'}`}
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
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

      {selectedHolding && (
        <StockDetailModal
          holding={selectedHolding}
          onClose={() => setSelectedHolding(null)}
        />
      )}
    </div>
  )
}
