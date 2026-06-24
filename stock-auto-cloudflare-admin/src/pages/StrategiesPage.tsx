import { useEffect, useState, useCallback } from 'react'
import { api } from '../utils/api'
import type {
  RiskCheckResult, PromotionEntry, ValidationStatus, LiveTradingReadiness,
  SystemHealth, SchedulerStatus, RebalanceEntry,
} from '../utils/api'
import {
  Search, Filter, ArrowUpDown, RefreshCw,
  ChevronLeft, ChevronRight, TrendingUp, Target, CheckCircle, XCircle, Eye,
  Shield, AlertTriangle, BarChart3, Activity, Clock, Database,
} from 'lucide-react'
import { formatKST } from '../utils/kst'

interface TopStrategy {
  strategy_id: number
  name: string
  generation: number
  version: number
  fitness: number
  return_pct: number
  win_rate: number
  mdd: number
  profit_factor: number
  total_trades: number
  entry_type: string
  stop_loss: number
  take_profit: number
  trailing_stop: number
  max_concurrent_positions: number
  ranking_candidate_limit: number
}

interface StrategyDetail extends TopStrategy {
  universe_stocks: { ticker: string; name: string; market: string }[]
}

type SortField = 'fitness' | 'return' | 'win_rate' | 'mdd' | 'generation'

const SORT_OPTIONS: { label: string; value: SortField }[] = [
  { label: 'Fitness', value: 'fitness' },
  { label: 'Return', value: 'return' },
  { label: 'Win Rate', value: 'win_rate' },
  { label: 'MDD', value: 'mdd' },
  { label: 'Generation', value: 'generation' },
]

type DetailTab = 'metrics' | 'risk' | 'promotion' | 'validation' | 'readiness'

export default function StrategiesPage() {
  const [data, setData] = useState<{ items: TopStrategy[]; total: number } | null>(null)
  const [offset, setOffset] = useState(0)
  const [limit] = useState(20)
  const [sortBy, setSortBy] = useState<SortField>('fitness')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyDetail | null>(null)
  const [addingToPortfolio, setAddingToPortfolio] = useState(false)
  const [portfolioStatus, setPortfolioStatus] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('metrics')
  const [riskData, setRiskData] = useState<RiskCheckResult | null>(null)
  const [promotions, setPromotions] = useState<PromotionEntry[]>([])
  const [validation, setValidation] = useState<ValidationStatus | null>(null)
  const [readiness, setReadiness] = useState<LiveTradingReadiness | null>(null)
  const [loadingExtra, setLoadingExtra] = useState(false)

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        offset: String(offset), limit: String(limit),
        sort_by: sortBy, sort_dir: sortDir,
      })
      const res = await api.get<{ items: TopStrategy[]; total: number }>(`/api/strategies/top?${params}`)
      setData(res)
    } catch {}
  }, [offset, limit, sortBy, sortDir])

  useEffect(() => { load() }, [load])

  const totalPages = data ? Math.ceil(data.total / limit) : 0
  const currentPage = Math.floor(offset / limit) + 1

  async function loadDetail(strategyId: number) {
    try {
      const d = await api.get<StrategyDetail>(`/api/strategies/top/${strategyId}`)
      setSelectedStrategy(d)
      setDetailTab('metrics')
      setLoadingExtra(true)

      const [risk, promos, val, ready] = await Promise.allSettled([
        api.get<RiskCheckResult>('/api/risk/check').catch(() => null),
        api.get<{ items: PromotionEntry[]; total: number }>('/api/portfolio/promotion-history?limit=5').catch(() => null),
        api.get<ValidationStatus>('/api/validation/status').catch(() => null),
        api.get<LiveTradingReadiness>('/api/live-trading/readiness').catch(() => null),
      ])

      if (risk.status === 'fulfilled') setRiskData(risk.value)
      else setRiskData(null)
      if (promos.status === 'fulfilled') setPromotions(promos.value?.items ?? [])
      else setPromotions([])
      if (val.status === 'fulfilled') setValidation(val.value)
      else setValidation(null)
      if (ready.status === 'fulfilled') setReadiness(ready.value)
      else setReadiness(null)

      setLoadingExtra(false)
    } catch (e) { console.error(e) }
  }

  async function addToPortfolio(s: TopStrategy) {
    setAddingToPortfolio(true)
    setPortfolioStatus(null)
    try {
      await api.post('/api/portfolio/strategies', {
        strategy_id: s.strategy_id,
        generation: s.generation,
        allocation: 0,
        status: 'candidate',
      })
      setPortfolioStatus('added')
    } catch {
      setPortfolioStatus('error')
    } finally {
      setAddingToPortfolio(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">Top Strategies</h2>
        <button onClick={load} className="p-2 text-text-muted hover:text-text transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-text-muted bg-surface-card rounded-xl px-3 py-2 border border-surface-border">
        <Target size={12} />
        <span>Filters: Fitness &ge; 50 &middot; Win Rate &ge; 45% &middot; Trades &ge; 30 &middot; MDD &le; 20% &middot; Return &ge; 20%</span>
      </div>

      <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
        {!data?.items ? (
          <div className="p-6 text-center text-xs text-text-muted">Loading...</div>
        ) : data.items.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">No strategies meet the criteria</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-surface-border">
                    <th className="text-left px-3 py-2 font-medium">Gen</th>
                    {SORT_OPTIONS.map(o => (
                      <th key={o.value} className="text-right px-2 py-2 font-medium">
                        <button onClick={() => { setSortBy(o.value); setSortDir(d => d === 'asc' ? 'desc' : 'asc') }}
                          className={`flex items-center gap-1 ml-auto hover:text-text transition-colors ${sortBy === o.value ? 'text-primary' : ''}`}>
                          {o.label} <ArrowUpDown size={10} />
                        </button>
                      </th>
                    ))}
                    <th className="text-right px-2 py-2 font-medium">Trades</th>
                    <th className="text-right px-2 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {data.items.map(s => (
                    <tr key={s.strategy_id} className="hover:bg-surface/50 transition-colors cursor-pointer"
                      onClick={() => loadDetail(s.strategy_id)}>
                      <td className="px-3 py-2 text-text font-medium">{s.generation}</td>
                      <td className="px-2 py-2 text-right text-amber-400">{s.fitness.toFixed(2)}</td>
                      <td className={`px-2 py-2 text-right ${s.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {s.return_pct >= 0 ? '+' : ''}{s.return_pct.toFixed(2)}%
                      </td>
                      <td className="px-2 py-2 text-right text-blue-400">{s.win_rate.toFixed(1)}%</td>
                      <td className="px-2 py-2 text-right text-red-400">{s.mdd.toFixed(2)}%</td>
                      <td className="px-2 py-2 text-right text-text-muted">{s.generation}</td>
                      <td className="px-2 py-2 text-right text-text-muted">{s.total_trades}</td>
                      <td className="px-2 py-2 text-right">
                        <button onClick={(e) => { e.stopPropagation(); addToPortfolio(s) }}
                          disabled={addingToPortfolio}
                          className="text-[10px] px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
                          {portfolioStatus === 'added' ? 'Added' : '+ Portfolio'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-surface-border">
              <span className="text-[11px] text-text-muted">
                {data.total} total &middot; Page {currentPage} of {totalPages || 1}
              </span>
              <div className="flex items-center gap-1">
                <button disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - limit))}
                  className="p-1.5 rounded-lg disabled:opacity-30 text-text-muted hover:text-text transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <button disabled={offset + limit >= data.total} onClick={() => setOffset(o => o + limit)}
                  className="p-1.5 rounded-lg disabled:opacity-30 text-text-muted hover:text-text transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedStrategy && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
          onClick={() => setSelectedStrategy(null)}>
          <div className="bg-surface-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-surface-card border-b border-surface-border px-4 py-3 flex items-center justify-between z-10">
              <h3 className="text-sm font-semibold text-text">Strategy #{selectedStrategy.strategy_id}</h3>
              <button onClick={() => setSelectedStrategy(null)} className="text-text-muted hover:text-text text-lg leading-none">&times;</button>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-surface-border overflow-x-auto">
              {[
                { id: 'metrics' as const, label: 'Metrics', icon: BarChart3 },
                { id: 'risk' as const, label: 'Risk', icon: Shield },
                { id: 'promotion' as const, label: 'Promotion', icon: TrendingUp },
                { id: 'validation' as const, label: 'Validation', icon: Activity },
                { id: 'readiness' as const, label: 'Readiness', icon: CheckCircle },
              ].map(tab => (
                <button key={tab.id} onClick={() => setDetailTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-colors
                    ${detailTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-text-muted hover:text-text'}`}>
                  <tab.icon size={12} />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-4">
              {detailTab === 'metrics' && (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-text-muted">Generation</span><p className="text-text font-medium">{selectedStrategy.generation}</p></div>
                    <div><span className="text-text-muted">Version</span><p className="text-text font-medium">{selectedStrategy.version}</p></div>
                    <div><span className="text-text-muted">Fitness</span><p className="text-amber-400 font-bold">{selectedStrategy.fitness.toFixed(2)}</p></div>
                    <div><span className="text-text-muted">Return</span><p className={`font-bold ${selectedStrategy.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {selectedStrategy.return_pct >= 0 ? '+' : ''}{selectedStrategy.return_pct.toFixed(2)}%</p></div>
                    <div><span className="text-text-muted">Win Rate</span><p className="text-blue-400 font-medium">{selectedStrategy.win_rate.toFixed(1)}%</p></div>
                    <div><span className="text-text-muted">MDD</span><p className="text-red-400 font-medium">{selectedStrategy.mdd.toFixed(2)}%</p></div>
                    <div><span className="text-text-muted">Total Trades</span><p className="text-text font-medium">{selectedStrategy.total_trades}</p></div>
                    <div><span className="text-text-muted">Profit Factor</span><p className="text-text font-medium">{selectedStrategy.profit_factor.toFixed(2)}</p></div>
                  </div>

                  <div className="border-t border-surface-border pt-3">
                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Parameters</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-text-muted">Entry Type</span><p className="text-text font-mono">{selectedStrategy.entry_type || '-'}</p></div>
                      <div><span className="text-text-muted">Stop Loss</span><p className="text-text">{selectedStrategy.stop_loss ? `${(selectedStrategy.stop_loss * 100).toFixed(1)}%` : '-'}</p></div>
                      <div><span className="text-text-muted">Take Profit</span><p className="text-text">{selectedStrategy.take_profit ? `${(selectedStrategy.take_profit * 100).toFixed(1)}%` : '-'}</p></div>
                      <div><span className="text-text-muted">Trailing Stop</span><p className="text-text">{selectedStrategy.trailing_stop ? `${(selectedStrategy.trailing_stop * 100).toFixed(1)}%` : '-'}</p></div>
                      <div><span className="text-text-muted">Max Concurrent</span><p className="text-text">{selectedStrategy.max_concurrent_positions || '-'}</p></div>
                      <div><span className="text-text-muted">Ranking Limit</span><p className="text-text">{selectedStrategy.ranking_candidate_limit || '-'}</p></div>
                    </div>
                  </div>

                  <div className="border-t border-surface-border pt-3">
                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Evaluation Universe</h4>
                    {selectedStrategy.universe_stocks?.length > 0 ? (
                      <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                        {selectedStrategy.universe_stocks.map((u, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs py-0.5">
                            <span className="text-text font-medium truncate">{u.name}</span>
                            <span className="text-text-muted shrink-0">{u.ticker}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-text-muted">No universe data</p>
                    )}
                  </div>

                  <button onClick={() => { addToPortfolio(selectedStrategy); setSelectedStrategy(null) }}
                    disabled={addingToPortfolio}
                    className="w-full text-xs px-3 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {portfolioStatus === 'added' ? 'Added to Portfolio' : 'Add to Portfolio'}
                  </button>
                </>
              )}

              {detailTab === 'risk' && (
                <RiskSection data={riskData} loading={loadingExtra} />
              )}

              {detailTab === 'promotion' && (
                <PromotionSection data={promotions} loading={loadingExtra} />
              )}

              {detailTab === 'validation' && (
                <ValidationSection data={validation} loading={loadingExtra} />
              )}

              {detailTab === 'readiness' && (
                <ReadinessSection data={readiness} loading={loadingExtra} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionLoading() {
  return <div className="text-xs text-text-muted text-center py-8">Loading...</div>
}

function RiskSection({ data, loading }: { data: RiskCheckResult | null; loading: boolean }) {
  if (loading) return <SectionLoading />
  if (!data) return <div className="text-xs text-text-muted text-center py-4">Risk data unavailable</div>

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${
        data.risk_status === 'PASS' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
      }`}>
        {data.risk_status === 'PASS' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
        Status: {data.risk_status} {data.blocked ? '(BLOCKED)' : ''}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-surface rounded-xl p-3">
          <div className="text-text-muted text-[10px]">Max Drawdown Limit</div>
          <div className="font-medium text-text">{data.max_drawdown.toFixed(1)}%</div>
        </div>
        <div className="bg-surface rounded-xl p-3">
          <div className="text-text-muted text-[10px]">Current Drawdown</div>
          <div className={`font-medium ${data.current_drawdown > data.max_drawdown ? 'text-red-400' : 'text-green-400'}`}>
            {data.current_drawdown.toFixed(1)}%
          </div>
        </div>
        <div className="bg-surface rounded-xl p-3">
          <div className="text-text-muted text-[10px]">Daily P&L</div>
          <div className={`font-medium ${data.daily_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.daily_pnl >= 0 ? '+' : ''}{data.daily_pnl.toFixed(2)}%
          </div>
        </div>
        <div className="bg-surface rounded-xl p-3">
          <div className="text-text-muted text-[10px]">Daily Loss Limit</div>
          <div className={`font-medium ${data.loss_limit_breached ? 'text-red-400' : 'text-green-400'}`}>
            {data.daily_loss_limit.toFixed(1)}%
          </div>
        </div>
      </div>

      {data.reasons.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Breaches</h4>
          <div className="space-y-1">
            {data.reasons.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/5 rounded-lg px-2.5 py-1.5">
                <AlertTriangle size={10} />
                {r}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PromotionSection({ data, loading }: { data: PromotionEntry[]; loading: boolean }) {
  if (loading) return <SectionLoading />
  if (!data || data.length === 0) return <div className="text-xs text-text-muted text-center py-4">No promotion history</div>

  return (
    <div className="space-y-2">
      {data.map(p => (
        <div key={p.id} className="flex items-center justify-between bg-surface rounded-xl px-3 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              p.action === 'promoted' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>{p.action}</span>
            <div>
              <div className="text-text font-medium">{p.strategy_name || `#${p.strategy_id}`}</div>
              {p.reason && <div className="text-text-muted text-[10px]">{p.reason}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-amber-400">fitness: {p.fitness.toFixed(2)}</div>
            <div className="text-text-muted text-[10px]">{formatKST(p.promoted_at)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ValidationSection({ data, loading }: { data: ValidationStatus | null; loading: boolean }) {
  if (loading) return <SectionLoading />
  if (!data) return <div className="text-xs text-text-muted text-center py-4">Validation mode inactive</div>

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${
        data.active ? 'bg-blue-500/10 text-blue-400' : 'bg-surface-border/50 text-text-muted'
      }`}>
        <Activity size={14} />
        {data.active ? `Active — Day ${data.days_elapsed}/30` : 'Inactive'}
        {data.started_at && <span className="text-text-muted">since {formatKST(data.started_at)}</span>}
      </div>

      {data.active && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-surface rounded-xl p-3 text-center">
            <div className="text-text-muted text-[10px]">Total Return</div>
            <div className={`font-bold ${data.total_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.total_return >= 0 ? '+' : ''}{data.total_return.toFixed(2)}%
            </div>
          </div>
          <div className="bg-surface rounded-xl p-3 text-center">
            <div className="text-text-muted text-[10px]">MDD</div>
            <div className="font-bold text-red-400">{data.current_mdd.toFixed(1)}%</div>
          </div>
          <div className="bg-surface rounded-xl p-3 text-center">
            <div className="text-text-muted text-[10px]">Win Rate</div>
            <div className="font-bold text-blue-400">{data.win_rate.toFixed(1)}%</div>
          </div>
        </div>
      )}

      {data.daily_logs && data.daily_logs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Daily Log</h4>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {[...data.daily_logs].reverse().map(log => (
              <div key={log.log_date} className="flex items-center justify-between bg-surface rounded-lg px-2.5 py-1.5 text-xs">
                <span className="text-text-muted text-[10px]">{log.log_date}</span>
                <div className="flex gap-3">
                  <span className={log.daily_return >= 0 ? 'text-green-400' : 'text-red-400'}>{log.daily_return >= 0 ? '+' : ''}{log.daily_return.toFixed(2)}%</span>
                  <span className="text-text">{log.cumulative_return.toFixed(2)}%</span>
                  <span className="text-blue-400">{log.win_rate.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ReadinessSection({ data, loading }: { data: LiveTradingReadiness | null; loading: boolean }) {
  if (loading) return <SectionLoading />
  if (!data) return <div className="text-xs text-text-muted text-center py-4">Readiness check unavailable</div>

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${
        data.ready ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
      }`}>
        {data.ready ? <CheckCircle size={14} /> : <Clock size={14} />}
        {data.ready ? 'Ready for Live Trading' : 'Not Ready'}
      </div>

      <div className="space-y-1.5">
        {data.checks?.map((check, i) => (
          <div key={i} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              {check.passed
                ? <CheckCircle size={12} className="text-green-400" />
                : <XCircle size={12} className="text-red-400" />
              }
              <span className="text-text">{check.name}</span>
            </div>
            <div className="text-right">
              <div className={`text-[11px] ${check.passed ? 'text-green-400' : 'text-red-400'}`}>
                {check.actual.toFixed(2)} / {check.threshold}
              </div>
              <div className="text-[9px] text-text-muted">{check.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
