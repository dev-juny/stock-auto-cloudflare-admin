import { useEffect, useState, useCallback } from 'react'
import { api } from '../utils/api'
import { useAction } from '../hooks/useAction'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { Tooltip } from '../components/common/Tooltip'
import { findGlossary } from '../utils/glossary'
import type {
  RiskCheckResult, PromotionEntry, ValidationStatus, LiveTradingReadiness,
} from '../utils/api'
import {
  ArrowUpDown, RefreshCw,
  ChevronLeft, ChevronRight, TrendingUp, Target, CheckCircle, XCircle,
  Shield, AlertTriangle, BarChart3, Activity, Clock,
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

function getMddColor(mdd: number): string {
  if (mdd < 5) return 'text-green-400'
  if (mdd < 10) return 'text-amber-400'
  if (mdd < 20) return 'text-orange-400'
  return 'text-red-400'
}

function getMddBg(mdd: number): string {
  if (mdd < 5) return 'bg-green-500/10'
  if (mdd < 10) return 'bg-amber-500/10'
  if (mdd < 20) return 'bg-orange-500/10'
  return 'bg-red-500/10'
}

export default function StrategiesPage() {
  const [data, setData] = useState<{ items: TopStrategy[]; total: number } | null>(null)
  const [offset, setOffset] = useState(0)
  const [limit] = useState(20)
  const [sortBy, setSortBy] = useState<SortField>('fitness')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyDetail | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('metrics')
  const [riskData, setRiskData] = useState<RiskCheckResult | null>(null)
  const [promotions, setPromotions] = useState<PromotionEntry[]>([])
  const [validation, setValidation] = useState<ValidationStatus | null>(null)
  const [readiness, setReadiness] = useState<LiveTradingReadiness | null>(null)
  const [loadingExtra, setLoadingExtra] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void; variant?: 'danger' | 'primary' } | null>(null)

  const { execute: addToPortfolioAction } = useAction()

  async function addToPortfolio(strategy: StrategyDetail) {
    await addToPortfolioAction(
      () => api.post('/api/portfolio/strategies', {
        strategy_id: strategy.strategy_id,
        generation: strategy.generation,
        allocation: 0,
        status: 'candidate',
      }),
      'Added to portfolio',
    )
  }

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

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-[10px] text-text-muted bg-surface-card rounded-xl px-3 py-2 border border-surface-border">
        <Target size={12} className="mt-0.5 shrink-0" />
        <span className="leading-relaxed">Filters: Fitness &ge; 50 &middot; Win Rate &ge; 45% &middot; Trades &ge; 30 &middot; MDD &le; 20% &middot; Return &ge; 20%</span>
        <button onClick={load} className="p-1 ml-auto text-text-muted hover:text-text transition-colors shrink-0">
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
        {!data?.items ? (
          <div className="p-6 text-center text-xs text-text-muted">Loading...</div>
        ) : data.items.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">No strategies meet the criteria</div>
        ) : (
          <>
            <div className="-mx-4 sm:mx-0 overflow-x-auto">
              <table className="w-full text-[10px] sm:text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-surface-border">
                    <th className="text-left px-1.5 sm:px-3 py-2 font-medium">
                      <button onClick={() => { setSortBy('generation'); setSortDir(d => d === 'asc' ? 'desc' : 'asc') }}
                        className={`flex items-center gap-0.5 sm:gap-1 hover:text-text transition-colors ${sortBy === 'generation' ? 'text-primary' : ''}`}>
                        Gen <ArrowUpDown size={8} />
                      </button>
                    </th>
                    {SORT_OPTIONS.filter(o => o.value !== 'generation').map(o => {
                      const labelKey = o.value === 'return' ? 'return' : o.value === 'win_rate' ? 'winRate' : o.value
                      return (
                      <th key={o.value} className="text-right px-1 sm:px-2 py-2 font-medium">
                        <button onClick={() => { setSortBy(o.value); setSortDir(d => d === 'asc' ? 'desc' : 'asc') }}
                          className={`flex items-center gap-0.5 sm:gap-1 ml-auto hover:text-text transition-colors ${sortBy === o.value ? 'text-primary' : ''}`}>
                          <Tooltip content={findGlossary(labelKey)?.description ?? o.label}>
                            <span>{o.label}</span>
                          </Tooltip>
                          <ArrowUpDown size={8} />
                        </button>
                      </th>
                    )})}
                    <th className="text-right px-1 sm:px-2 py-2 font-medium">
                      <Tooltip content={findGlossary('mdd')?.description ?? 'MDD'}>
                        <span>MDD</span>
                      </Tooltip>
                    </th>
                    <th className="text-right px-1 sm:px-2 py-2 font-medium whitespace-nowrap">
                      <Tooltip content={findGlossary('totalTrades')?.description ?? 'Trades'}>
                        <span>Trades</span>
                      </Tooltip>
                    </th>
                    <th className="text-right px-1 sm:px-2 py-2 font-medium whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {data.items.map(s => (
                    <tr key={s.strategy_id} className="hover:bg-surface/50 transition-colors cursor-pointer"
                      onClick={() => loadDetail(s.strategy_id)}>
                      <td className="px-1.5 sm:px-3 py-2 text-text font-medium">{s.generation}</td>
                      <td className="px-1 sm:px-2 py-2 text-right text-amber-400 whitespace-nowrap">{s.fitness.toFixed(2)}</td>
                      <td className={`px-1 sm:px-2 py-2 text-right whitespace-nowrap ${s.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {s.return_pct >= 0 ? '+' : ''}{s.return_pct.toFixed(2)}%
                      </td>
                      <td className="px-1 sm:px-2 py-2 text-right text-blue-400 whitespace-nowrap">{s.win_rate.toFixed(1)}%</td>
                      <td className={`px-1 sm:px-2 py-2 text-right font-medium whitespace-nowrap ${getMddColor(s.mdd)}`}>{s.mdd.toFixed(2)}%</td>
                      <td className="px-1 sm:px-2 py-2 text-right text-text-muted">{s.total_trades}</td>
                      <td className="px-1 sm:px-2 py-2 text-right">
                        <AddToPortfolioButton strategy={s} onDone={load} />
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

            <div className="flex border-b border-surface-border overflow-x-auto scrollbar-none">
              {[
                { id: 'metrics' as const, label: '메트릭', icon: BarChart3 },
                { id: 'risk' as const, label: '리스크', icon: Shield },
                { id: 'promotion' as const, label: '승격', icon: TrendingUp },
                { id: 'validation' as const, label: '검증', icon: Activity },
                { id: 'readiness' as const, label: '준비도', icon: CheckCircle },
              ].map(tab => (
                <button key={tab.id} onClick={() => setDetailTab(tab.id)}
                  className={`flex items-center gap-1 px-2 sm:gap-1.5 sm:px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-colors
                    ${detailTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-text-muted hover:text-text'}`}>
                  <tab.icon size={12} />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              {detailTab === 'metrics' && (
                <MetricsSection strategy={selectedStrategy} onAddToPortfolio={() => {
                  addToPortfolio(selectedStrategy)
                  setSelectedStrategy(null)
                }} />
              )}

              {detailTab === 'risk' && (
                <RiskSection data={riskData} loading={loadingExtra} onRefresh={() => loadDetail(selectedStrategy.strategy_id)} />
              )}

              {detailTab === 'promotion' && (
                <PromotionSection data={promotions} loading={loadingExtra} onRefresh={() => loadDetail(selectedStrategy.strategy_id)} />
              )}

              {detailTab === 'validation' && (
                <ValidationSection data={validation} loading={loadingExtra} onRefresh={() => {
                  loadDetail(selectedStrategy.strategy_id)
                }} />
              )}

              {detailTab === 'readiness' && (
                <ReadinessSection data={readiness} loading={loadingExtra} />
              )}
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <ConfirmDialog
          open={true}
          title={confirmAction.title}
          message={confirmAction.message}
          variant={confirmAction.variant}
          onConfirm={() => { confirmAction.onConfirm(); setConfirmAction(null) }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  )
}

function SectionLoading() {
  return <div className="text-xs text-text-muted text-center py-8">Loading...</div>
}

function SectionError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-6">
      <AlertTriangle size={20} className="mx-auto mb-2 text-amber-400" />
      <p className="text-xs text-text-muted mb-2">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
          Retry
        </button>
      )}
    </div>
  )
}

function AddToPortfolioButton({ strategy, onDone }: { strategy: { strategy_id: number; generation: number }; onDone: () => void }) {
  const { loading, execute } = useAction()
  const [added, setAdded] = useState(false)

  async function handleAdd() {
    await execute(
      () => api.post('/api/portfolio/strategies', {
        strategy_id: strategy.strategy_id,
        generation: strategy.generation,
        allocation: 0,
        status: 'candidate',
      }),
      'Added to portfolio',
    )
    setAdded(true)
    onDone()
  }

  return (
    <button onClick={(e) => { e.stopPropagation(); handleAdd() }}
      disabled={loading || added}
      className="text-[10px] px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
      {added ? 'Added' : loading ? '...' : '+ Portfolio'}
    </button>
  )
}

function MetricsSection({ strategy, onAddToPortfolio }: { strategy: StrategyDetail; onAddToPortfolio: () => void }) {
  return (
    <>
            <div className="grid grid-cols-2 gap-2 text-xs break-words">
              <div><Tooltip content={findGlossary('generation')?.description ?? 'Generation'}><span className="text-text-muted">Generation</span></Tooltip><p className="text-text font-medium">{strategy.generation}</p></div>
        <div><span className="text-text-muted">Version</span><p className="text-text font-medium">{strategy.version}</p></div>
        <div><Tooltip content={findGlossary('fitness')?.description ?? 'Fitness'}><span className="text-text-muted">Fitness</span></Tooltip><p className="text-amber-400 font-bold">{strategy.fitness.toFixed(2)}</p></div>
        <div><Tooltip content={findGlossary('return')?.description ?? 'Return'}><span className="text-text-muted">Return</span></Tooltip><p className={`font-bold ${strategy.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {strategy.return_pct >= 0 ? '+' : ''}{strategy.return_pct.toFixed(2)}%</p></div>
        <div><Tooltip content={findGlossary('winRate')?.description ?? 'Win Rate'}><span className="text-text-muted">Win Rate</span></Tooltip><p className="text-blue-400 font-medium">{strategy.win_rate.toFixed(1)}%</p></div>
        <div>
          <Tooltip content={findGlossary('mdd')?.description ?? 'MDD'}><span className="text-text-muted">MDD</span></Tooltip>
          <p className={`font-medium ${getMddColor(strategy.mdd)}`}>{strategy.mdd.toFixed(2)}%</p>
        </div>
        <div><Tooltip content={findGlossary('totalTrades')?.description ?? 'Total Trades'}><span className="text-text-muted">Total Trades</span></Tooltip><p className="text-text font-medium">{strategy.total_trades}</p></div>
        <div><Tooltip content={findGlossary('profitFactor')?.description ?? 'Profit Factor'}><span className="text-text-muted">Profit Factor</span></Tooltip><p className="text-text font-medium">{strategy.profit_factor.toFixed(2)}</p></div>
      </div>

      <div className="border-t border-surface-border pt-3">
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Parameters</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><Tooltip content={findGlossary('entryType')?.description ?? 'Entry Type'}><span className="text-text-muted">Entry Type</span></Tooltip><p className="text-text font-mono">{strategy.entry_type || '-'}</p></div>
          <div><Tooltip content={findGlossary('stopLoss')?.description ?? 'Stop Loss'}><span className="text-text-muted">Stop Loss</span></Tooltip><p className="text-text">{strategy.stop_loss ? `${(strategy.stop_loss * 100).toFixed(1)}%` : '-'}</p></div>
          <div><Tooltip content={findGlossary('takeProfit')?.description ?? 'Take Profit'}><span className="text-text-muted">Take Profit</span></Tooltip><p className="text-text">{strategy.take_profit ? `${(strategy.take_profit * 100).toFixed(1)}%` : '-'}</p></div>
          <div><Tooltip content={findGlossary('trailingStop')?.description ?? 'Trailing Stop'}><span className="text-text-muted">Trailing Stop</span></Tooltip><p className="text-text">{strategy.trailing_stop ? `${(strategy.trailing_stop * 100).toFixed(1)}%` : '-'}</p></div>
          <div><Tooltip content={findGlossary('maxPositions')?.description ?? 'Max Concurrent'}><span className="text-text-muted">Max Concurrent</span></Tooltip><p className="text-text">{strategy.max_concurrent_positions || '-'}</p></div>
          <div><span className="text-text-muted">Ranking Limit</span><p className="text-text">{strategy.ranking_candidate_limit || '-'}</p></div>
        </div>
      </div>

      <div className="border-t border-surface-border pt-3">
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Evaluation Universe</h4>
        {strategy.universe_stocks?.length > 0 ? (
          <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
            {strategy.universe_stocks.map((u, i) => (
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

      <button onClick={onAddToPortfolio}
        className="w-full text-xs px-3 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors">
        Add to Portfolio
      </button>
    </>
  )
}

function RiskSection({ data, loading, onRefresh }: { data: RiskCheckResult | null; loading: boolean; onRefresh: () => void }) {
  if (loading) return <SectionLoading />
  if (!data) return <SectionError message="No risk data" onRetry={onRefresh} />

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
          <Tooltip content={findGlossary('mdd')?.description ?? 'Portfolio MDD'}>
            <div className="text-text-muted text-[10px]">Portfolio MDD</div>
          </Tooltip>
          <div className="font-medium text-text">{data.portfolio_mdd.toFixed(1)}%</div>
        </div>
        <div className="bg-surface rounded-xl p-3">
          <div className="text-text-muted text-[10px]">Avg Unrealized P&L</div>
          <div className={`font-medium ${data.avg_unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.avg_unrealized_pnl >= 0 ? '+' : ''}{data.avg_unrealized_pnl.toFixed(2)}%
          </div>
        </div>
        <div className="bg-surface rounded-xl p-3">
          <div className="text-text-muted text-[10px]">Daily P&L</div>
          <div className={`font-medium ${data.today_pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.today_pnl_pct >= 0 ? '+' : ''}{data.today_pnl_pct.toFixed(2)}%
          </div>
        </div>
        <div className="bg-surface rounded-xl p-3">
          <Tooltip content={findGlossary('maxPositions')?.description ?? 'Open Positions'}>
            <div className="text-text-muted text-[10px]">Open Positions</div>
          </Tooltip>
          <div className="font-medium text-text">{data.open_positions}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {data.cash_ratio > 0 && (
          <div className="bg-surface rounded-xl p-3">
            <Tooltip content={findGlossary('cashRatio')?.description ?? 'Cash Ratio'}>
              <div className="text-text-muted text-[10px]">Cash Ratio</div>
            </Tooltip>
            <div className="font-medium text-blue-400">{data.cash_ratio.toFixed(1)}%</div>
          </div>
        )}
        {data.single_asset_ratio > 0 && (
          <div className="bg-surface rounded-xl p-3">
            <div className="text-text-muted text-[10px]">Single Asset Ratio</div>
            <div className="font-medium text-text">{data.single_asset_ratio.toFixed(1)}%</div>
          </div>
        )}
      </div>

      {data.blocked && data.reasons.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">BLOCKED Reasons</h4>
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

function PromotionSection({ data, loading, onRefresh }: { data: PromotionEntry[]; loading: boolean; onRefresh: () => void }) {
  const { loading: actionLoading, execute } = useAction()
  if (loading) return <SectionLoading />

  async function autoPromote() {
    await execute(
      () => api.post<{ message?: string; promoted?: number }>('/api/portfolio/auto-promote'),
      'Auto promote completed',
    )
    onRefresh()
  }

  if (!data || data.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-xs text-text-muted text-center py-4">No promotion history</div>
        <button onClick={autoPromote} disabled={actionLoading}
          className="w-full text-xs px-3 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
          {actionLoading ? 'Running...' : 'Auto Promote Candidates'}
        </button>
      </div>
    )
  }

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
      <button onClick={autoPromote} disabled={actionLoading}
        className="w-full text-xs px-3 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
        {actionLoading ? 'Running...' : 'Auto Promote Candidates'}
      </button>
    </div>
  )
}

function ValidationSection({ data: data_, loading, onRefresh }: { data: ValidationStatus | null; loading: boolean; onRefresh: () => void }) {
  const { loading: actionLoading, execute } = useAction()
  if (loading) return <SectionLoading />
  if (!data_) return <SectionError message="Validation mode inactive" onRetry={onRefresh} />

  const data = data_

  async function toggleValidation() {
    const endpoint = data.is_active ? '/api/validation/stop' : '/api/validation/start'
    await execute(
      () => api.post<{ message?: string }>(endpoint),
      data.is_active ? 'Validation stopped' : 'Validation started',
    )
    onRefresh()
  }

  const daysElapsed = data.started_at
    ? Math.floor((Date.now() - new Date(data.started_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${
        data.is_active ? 'bg-blue-500/10 text-blue-400' : 'bg-surface-border/50 text-text-muted'
      }`}>
        <Activity size={14} />
        {data.is_active ? `Active — Day ${Math.min(daysElapsed + 1, 30)}/30` : 'Inactive'}
        {data.started_at && <span className="text-text-muted">since {formatKST(data.started_at)}</span>}
      </div>

      {data.is_active && data.today && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-surface rounded-xl p-3 text-center">
            <Tooltip content={findGlossary('return')?.description ?? 'Total Return'}>
              <div className="text-text-muted text-[10px]">Total Return</div>
            </Tooltip>
            <div className={`font-bold ${data.today.cumulative_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.today.cumulative_return >= 0 ? '+' : ''}{data.today.cumulative_return.toFixed(2)}%
            </div>
          </div>
          <div className="bg-surface rounded-xl p-3 text-center">
            <Tooltip content={findGlossary('mdd')?.description ?? 'MDD'}>
              <div className="text-text-muted text-[10px]">MDD</div>
            </Tooltip>
            <div className="font-bold text-red-400">{data.today.mdd.toFixed(1)}%</div>
          </div>
          <div className="bg-surface rounded-xl p-3 text-center">
            <Tooltip content={findGlossary('winRate')?.description ?? 'Win Rate'}>
              <div className="text-text-muted text-[10px]">Win Rate</div>
            </Tooltip>
            <div className="font-bold text-blue-400">{data.today.win_rate.toFixed(1)}%</div>
          </div>
        </div>
      )}

      <button onClick={toggleValidation} disabled={actionLoading}
        className="w-full text-xs px-3 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
        {actionLoading ? 'Processing...' : data.is_active ? 'Stop Validation' : 'Start Validation'}
      </button>
    </div>
  )
}

function ReadinessSection({ data, loading }: { data: LiveTradingReadiness | null; loading: boolean }) {
  if (loading) return <SectionLoading />
  if (!data) return <SectionError message="Readiness check unavailable" />

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
          <div key={i} className="bg-surface rounded-lg px-3 py-2 text-xs">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                {check.passed
                  ? <CheckCircle size={12} className="text-green-400" />
                  : <XCircle size={12} className="text-red-400" />
                }
                <span className="text-text font-medium">{check.name}</span>
              </div>
              <span className={`text-[11px] font-mono ${check.passed ? 'text-green-400' : 'text-red-400'}`}>
                {check.passed ? 'PASS' : 'FAIL'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-text-muted">
              <span>Current: {check.actual.toFixed(2)}</span>
              <span>Target: {check.threshold}</span>
              {!check.passed && (
                <span className="text-amber-400">Gap: {(check.threshold - check.actual).toFixed(2)}</span>
              )}
            </div>
            <div className="text-[9px] text-text-muted mt-0.5">{check.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
