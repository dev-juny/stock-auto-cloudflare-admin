import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { Card } from '../components/common/Card'
import { CardSkeleton } from '../components/common/Skeleton'
import { useAction } from '../hooks/useAction'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import {
  Factory, TrendingUp, TrendingDown, Award, Beaker, XCircle, Archive,
  RefreshCw, Save, ArrowUp, ArrowDown, Clock, Eye, Lock, Unlock,
} from 'lucide-react'

interface StageStrategy {
  strategy_id: number
  generation: number
  allocation: number
  status: string
  name: string
  entry_type: string
  total_return: number
  win_rate: number
  mdd: number
  profit_factor: number
  fitness: number
  trades: number
  approved_at: string
  created_at: string
  survivor_score?: number
  score_breakdown?: Record<string, number>
}

interface PoolEntry {
  id: number
  strategy_id: number
  name: string
  generation: number
  survivor_score: number
  score_breakdown: Record<string, number>
  eval_count: number
  status: string
  total_return: number
  win_rate: number
  mdd: number
  profit_factor: number
  fitness: number
  trades: number
}

interface HistoryEntry {
  id: number
  strategy_id: number
  name: string
  generation: number
  action: string
  reason: string
  from: string
  to: string
  score_before: number | null
  score_after: number | null
  created_at: string
}

interface Weights {
  recent_paper_return: number
  portfolio_backtest_return: number
  profit_factor: number
  max_drawdown: number
  sharpe_ratio: number
  stability: number
}

interface ShadowSession {
  id: number
  strategy_id: number
  name: string
  generation: number
  status: string
  started_at: string
  ended_at: string | null
  total_orders: number
  successful_orders: number
  failed_orders: number
  total_pnl: number
  total_return: number
  win_rate: number
}

interface ProductionLock {
  locked: boolean
  locked_at: string
  locked_by: string
  reason: string
  strategy_id: number
}

interface DashboardData {
  production: StageStrategy[]
  candidates: StageStrategy[]
  shadow_trading: StageStrategy[]
  survivors: StageStrategy[]
  paper_trading: StageStrategy[]
  failed: StageStrategy[]
  retired: StageStrategy[]
  survivor_pool: PoolEntry[]
  shadow_sessions: ShadowSession[]
  production_lock: ProductionLock
  weights: Weights
  history: HistoryEntry[]
  summary: {
    production_count: number
    candidate_count: number
    shadow_trading_count: number
    survivor_count: number
    paper_trading_count: number
    failed_count: number
    retired_count: number
    pool_count: number
    shadow_sessions_count: number
  }
}

function formatPct(v: number | undefined | null) {
  if (v == null) return '-'
  const f = v.toFixed(2)
  return `${v >= 0 ? '+' : ''}${f}%`
}

function formatScore(v: number | undefined | null) {
  if (v == null) return '-'
  return v.toFixed(3)
}

function pnlColor(v: number | undefined | null) {
  if (v == null) return 'text-text'
  return v >= 0 ? 'text-green-400' : 'text-red-400'
}

function StageCountCard({ label, sub, count, icon: Icon, color, bg }: {
  label: string; sub: string; count: number; icon: any; color: string; bg: string
}) {
  return (
    <Card className={`p-3 ${bg} border-0`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-bold text-text">{count}</div>
          <div className="text-[10px] text-text-muted">{label}</div>
          <div className="text-[9px] text-text-muted">{sub}</div>
        </div>
        <Icon size={20} className={color} />
      </div>
    </Card>
  )
}

function StrategyTable({ title, strategies, actions }: {
  title: string
  strategies: StageStrategy[]
  actions?: (s: StageStrategy) => React.ReactNode
}) {
  if (!strategies || strategies.length === 0) {
    return (
      <Card className="p-3">
        <div className="text-xs font-semibold text-text mb-2">{title}</div>
        <div className="text-[10px] text-text-muted text-center py-4">No strategies</div>
      </Card>
    )
  }
  return (
    <Card className="p-3">
      <div className="text-xs font-semibold text-text mb-2">{title} ({strategies.length})</div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-text-muted border-b border-white/5">
              <th className="text-left py-1 pr-2">Name</th>
              <th className="text-right px-1">Gen</th>
              <th className="text-right px-1">Score</th>
              <th className="text-right px-1">Return</th>
              <th className="text-right px-1">Win%</th>
              <th className="text-right px-1">MDD</th>
              <th className="text-right px-1">PF</th>
              {actions && <th className="text-right pl-2">Action</th>}
            </tr>
          </thead>
          <tbody>
            {strategies.map((s, i) => (
              <tr key={s.strategy_id ?? i} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-1 pr-2 text-text font-medium max-w-[100px] truncate">{s.name || `#${s.strategy_id}`}</td>
                <td className="text-right px-1 text-text-muted font-mono tabular-nums">{s.generation ?? '-'}</td>
                <td className={`text-right px-1 font-mono tabular-nums ${pnlColor(s.survivor_score)}`}>{formatScore(s.survivor_score)}</td>
                <td className={`text-right px-1 font-mono tabular-nums ${pnlColor(s.total_return)}`}>{formatPct(s.total_return)}</td>
                <td className="text-right px-1 font-mono tabular-nums text-text">{s.win_rate != null ? `${s.win_rate.toFixed(1)}%` : '-'}</td>
                <td className="text-right px-1 font-mono tabular-nums text-red-400">{s.mdd != null ? `${Math.abs(s.mdd).toFixed(1)}%` : '-'}</td>
                <td className="text-right px-1 font-mono tabular-nums text-text">{s.profit_factor != null ? s.profit_factor.toFixed(2) : '-'}</td>
                {actions && <td className="text-right pl-2">{actions(s)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function PoolTable({ title, entries, actions }: {
  title: string
  entries: PoolEntry[]
  actions?: (e: PoolEntry) => React.ReactNode
}) {
  if (!entries || entries.length === 0) return null
  return (
    <Card className="p-3">
      <div className="text-xs font-semibold text-text mb-2">{title} ({entries.length})</div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-text-muted border-b border-white/5">
              <th className="text-left py-1 pr-2">Name</th>
              <th className="text-right px-1">Score</th>
              <th className="text-right px-1">Return</th>
              <th className="text-right px-1">Win%</th>
              <th className="text-right px-1">MDD</th>
              <th className="text-right px-1">PF</th>
              <th className="text-right px-1">Eval</th>
              {actions && <th className="text-right pl-2">Action</th>}
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.id ?? i} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-1 pr-2 text-text font-medium max-w-[100px] truncate">{e.name || `#${e.strategy_id}`}</td>
                <td className={`text-right px-1 font-mono tabular-nums ${pnlColor(e.survivor_score)}`}>{formatScore(e.survivor_score)}</td>
                <td className={`text-right px-1 font-mono tabular-nums ${pnlColor(e.total_return)}`}>{formatPct(e.total_return)}</td>
                <td className="text-right px-1 font-mono tabular-nums text-text">{e.win_rate != null ? `${e.win_rate.toFixed(1)}%` : '-'}</td>
                <td className="text-right px-1 font-mono tabular-nums text-red-400">{e.mdd != null ? `${Math.abs(e.mdd).toFixed(1)}%` : '-'}</td>
                <td className="text-right px-1 font-mono tabular-nums text-text">{e.profit_factor != null ? e.profit_factor.toFixed(2) : '-'}</td>
                <td className="text-right px-1 font-mono tabular-nums text-text-muted">{e.eval_count ?? 0}</td>
                {actions && <td className="text-right pl-2">{actions(e)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default function ProductionDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editWeights, setEditWeights] = useState(false)
  const [weights, setWeights] = useState<Weights | null>(null)
  const [expandedHistory, setExpandedHistory] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    title: string
    message: string
    onConfirm: () => void
    variant?: 'danger' | 'primary'
  } | null>(null)
  const { loading: saving, execute: saveAction } = useAction()
  const { loading: promoting, execute: promoteAction } = useAction()
  const { loading: rollbackLoading, execute: rollbackExec } = useAction()

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const d = await api.get<DashboardData>('/api/production/dashboard')
      setData(d)
      setWeights(d.weights)
    } catch (e: any) {
      setError(e.message || 'Failed to load production dashboard')
    }
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  async function saveWeights() {
    if (!weights) return
    await saveAction(
      () => api.post('/api/production/weights', weights),
      'Weights saved',
    )
    setEditWeights(false)
  }

  async function promoteToProduction(sid: number, name: string) {
    const result = await promoteAction(
      () => api.post('/api/production/promote-to-production', { strategy_id: sid, reason: 'Manual promotion from dashboard' }),
      `${name} promoted to production`,
    )
    if (result) loadAll()
  }

  async function promoteStrategy(sid: number, name: string) {
    const result = await promoteAction(
      () => api.post('/api/production/promote', { strategy_id: sid, reason: 'Manual promotion from dashboard' }),
      `${name} promoted`,
    )
    if (result) loadAll()
  }

  async function demoteStrategy(sid: number, name: string, target: string) {
    const result = await rollbackExec(
      () => api.post('/api/production/demote', { strategy_id: sid, target, reason: `Manual ${target} from dashboard` }),
      `${name} demoted to ${target}`,
    )
    if (result) loadAll()
  }

  async function rollbackStrategy(sid: number, name: string) {
    const result = await rollbackExec(
      () => api.post('/api/production/rollback', { strategy_id: sid, reason: 'Manual rollback from dashboard' }),
      `${name} rolled back`,
    )
    if (result) loadAll()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-5 w-24" />
        <div className="grid grid-cols-3 gap-3">{[1, 2, 3, 4, 5, 6].map(i => <CardSkeleton key={i} />)}</div>
        <div className="skeleton h-5 w-48" />
        <div className="skeleton h-40 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <XCircle size={24} className="text-red-400" />
        <p className="text-xs text-text-muted">{error}</p>
        <button onClick={loadAll} className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20">Retry</button>
      </div>
    )
  }

  const s = data?.summary ?? {} as DashboardData['summary']
  const counts = [
    { key: 'production', label: 'Production', sub: '운영 중', count: s.production_count ?? 0, icon: Factory, color: 'text-green-400', bg: 'bg-green-500/15' },
    { key: 'candidates', label: 'Candidates', sub: '후보', count: s.candidate_count ?? 0, icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/15' },
    { key: 'shadow_trading', label: 'Shadow', sub: '그림자매매', count: s.shadow_trading_count ?? 0, icon: Eye, color: 'text-cyan-400', bg: 'bg-cyan-500/15' },
    { key: 'survivors', label: 'Survivors', sub: '생존자', count: s.survivor_count ?? 0, icon: Award, color: 'text-blue-400', bg: 'bg-blue-500/15' },
    { key: 'paper_trading', label: 'Paper Trading', sub: '가상매매', count: s.paper_trading_count ?? 0, icon: Beaker, color: 'text-purple-400', bg: 'bg-purple-500/15' },
    { key: 'failed', label: 'Failed', sub: '실패', count: s.failed_count ?? 0, icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/15' },
    { key: 'retired', label: 'Retired', sub: '퇴출', count: s.retired_count ?? 0, icon: Archive, color: 'text-text-muted', bg: 'bg-surface' },
  ]

  const weightLabels: Record<string, { label: string; sub: string }> = {
    recent_paper_return: { label: 'Recent Paper Return', sub: '최근 가상매매 수익률' },
    portfolio_backtest_return: { label: 'Portfolio Backtest Return', sub: '포트폴리오 백테스트 수익률' },
    profit_factor: { label: 'Profit Factor', sub: '수익 팩터' },
    max_drawdown: { label: 'Max Drawdown', sub: '최대 낙폭' },
    sharpe_ratio: { label: 'Sharpe Ratio', sub: '샤프 비율' },
    stability: { label: 'Stability', sub: '안정성' },
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-text">Production Dashboard</h1>
          <p className="text-[10px] text-text-muted">전략 생애주기 관리</p>
        </div>
        <button onClick={loadAll} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-surface text-text-muted hover:text-text transition-colors">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Stage counts */}
      <div className="grid grid-cols-3 gap-3">
        {counts.map(c => (
          <StageCountCard key={c.key} label={c.label} sub={c.sub} count={c.count} icon={c.icon} color={c.color} bg={c.bg} />
        ))}
      </div>

      {/* Production strategies */}
      {data?.production && (
        <StrategyTable
          title="Production Strategies"
          strategies={data.production}
          actions={(s) => (
            <button
              onClick={() => setConfirmAction({
                title: 'Rollback Strategy',
                message: `Rollback "${s.name || `#${s.strategy_id}`}" to survivor?`,
                variant: 'danger',
                onConfirm: () => rollbackStrategy(s.strategy_id, s.name || `#${s.strategy_id}`),
              })}
              disabled={rollbackLoading}
              className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
            >
              Rollback
            </button>
          )}
        />
      )}

      {/* Survivor Pool */}
      {data?.survivor_pool && data.survivor_pool.length > 0 && (
        <PoolTable
          title="Survivor Pool"
          entries={data.survivor_pool}
          actions={(e) => (
            <button
              onClick={() => setConfirmAction({
                title: 'Promote to Production',
                message: `Promote "${e.name || `#${e.strategy_id}`}" directly to production?`,
                variant: 'primary',
                onConfirm: () => promoteToProduction(e.strategy_id, e.name || `#${e.strategy_id}`),
              })}
              disabled={promoting}
              className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30"
            >
              Promote
            </button>
          )}
        />
      )}

      {/* Candidates */}
      {data?.candidates && data.candidates.length > 0 && (
        <StrategyTable
          title="Production Candidates"
          strategies={data.candidates}
          actions={(s) => (
            <button
              onClick={() => setConfirmAction({
                title: 'Promote to Production',
                message: `Promote "${s.name || `#${s.strategy_id}`}" to production?`,
                variant: 'primary',
                onConfirm: () => promoteToProduction(s.strategy_id, s.name || `#${s.strategy_id}`),
              })}
              disabled={promoting}
              className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30"
            >
              Promote
            </button>
          )}
        />
      )}

      {/* Survivors */}
      {data?.survivors && data.survivors.length > 0 && (
        <StrategyTable
          title="Survivors"
          strategies={data.survivors}
          actions={(s) => (
            <div className="flex gap-1 justify-end">
              <button
                onClick={() => setConfirmAction({
                  title: 'Promote Survivor',
                  message: `Promote "${s.name || `#${s.strategy_id}`}" from survivor to production_candidate?`,
                  variant: 'primary',
                  onConfirm: () => promoteStrategy(s.strategy_id, s.name || `#${s.strategy_id}`),
                })}
                disabled={promoting}
                className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
              >
                Promote
              </button>
              <button
                onClick={() => setConfirmAction({
                  title: 'Fail Survivor',
                  message: `Mark "${s.name || `#${s.strategy_id}`}" as failed?`,
                  variant: 'danger',
                  onConfirm: () => demoteStrategy(s.strategy_id, s.name || `#${s.strategy_id}`, 'failed'),
                })}
                disabled={rollbackLoading}
                className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
              >
                Fail
              </button>
            </div>
          )}
        />
      )}

      {/* Shadow Trading */}
      {data?.shadow_trading && data.shadow_trading.length > 0 && (
        <StrategyTable
          title="Shadow Trading"
          strategies={data.shadow_trading}
          actions={(s) => (
            <button
              onClick={() => setConfirmAction({
                title: 'Promote to Production',
                message: `Promote "${s.name || `#${s.strategy_id}`}" from shadow to production?`,
                variant: 'primary',
                onConfirm: () => promoteToProduction(s.strategy_id, s.name || `#${s.strategy_id}`),
              })}
              className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30"
            >
              Promote
            </button>
          )}
        />
      )}

      {/* Shadow Sessions */}
      {data?.shadow_sessions && data.shadow_sessions.length > 0 && (
        <Card className="p-3">
          <div className="text-xs font-semibold text-text mb-2">Shadow Sessions ({data.shadow_sessions.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-text-muted border-b border-white/5">
                  <th className="text-left py-1 pr-2">Strategy</th>
                  <th className="text-right px-1">Status</th>
                  <th className="text-right px-1">Orders</th>
                  <th className="text-right px-1">PnL</th>
                  <th className="text-right px-1">Return</th>
                  <th className="text-right px-1">Win%</th>
                  <th className="text-right pl-2">Started</th>
                </tr>
              </thead>
              <tbody>
                {data.shadow_sessions.map((ss, i) => (
                  <tr key={ss.id ?? i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-1 pr-2 text-text font-medium">{ss.name || `#${ss.strategy_id}`}</td>
                    <td className="text-right px-1"><span className={`text-[9px] px-1 py-0.5 rounded ${ss.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-text-muted'}`}>{ss.status}</span></td>
                    <td className="text-right px-1 font-mono tabular-nums text-text">{ss.successful_orders ?? 0}/{ss.total_orders ?? 0}</td>
                    <td className={`text-right px-1 font-mono tabular-nums ${(ss.total_pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{(ss.total_pnl ?? 0).toFixed(0)}</td>
                    <td className={`text-right px-1 font-mono tabular-nums ${(ss.total_return ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{(ss.total_return ?? 0).toFixed(2)}%</td>
                    <td className="text-right px-1 font-mono tabular-nums text-text">{ss.win_rate ? `${ss.win_rate.toFixed(1)}%` : '-'}</td>
                    <td className="text-right pl-2 text-text-muted font-mono text-[9px]">{ss.started_at ? new Date(ss.started_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Production Lock */}
      {data?.production_lock && (
        <Card className={`p-3 ${data.production_lock.locked ? 'bg-yellow-500/10' : ''}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {data.production_lock.locked ? <Lock size={14} className="text-yellow-400" /> : <Unlock size={14} className="text-green-400" />}
              <div className="text-xs font-semibold text-text">Production Lock</div>
            </div>
            <span className={`text-[9px] px-1.5 py-0.5 rounded ${data.production_lock.locked ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
              {data.production_lock.locked ? 'LOCKED' : 'UNLOCKED'}
            </span>
          </div>
          {data.production_lock.locked && (
            <div className="text-[9px] text-text-muted">
              {data.production_lock.reason && <span>Reason: {data.production_lock.reason} | </span>}
              {data.production_lock.locked_by && <span>By: {data.production_lock.locked_by} | </span>}
              {data.production_lock.strategy_id ? <span>Strategy: #{data.production_lock.strategy_id}</span> : null}
            </div>
          )}
        </Card>
      )}

      {/* Paper Trading */}
      {data?.paper_trading && data.paper_trading.length > 0 && (
        <StrategyTable title="Paper Trading" strategies={data.paper_trading} />
      )}

      {/* Failed / Retired */}
      {(data?.failed && data.failed.length > 0) && (
        <StrategyTable title="Failed Strategies" strategies={data.failed} />
      )}
      {(data?.retired && data.retired.length > 0) && (
        <StrategyTable title="Retired Strategies" strategies={data.retired} />
      )}

      {/* Survivor Score Weights */}
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs font-semibold text-text">Survivor Score Weights</div>
            <div className="text-[9px] text-text-muted">생존 점수 가중치</div>
          </div>
          <div className="flex gap-1">
            {!editWeights ? (
              <button onClick={() => setEditWeights(true)} className="text-[9px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20">
                Edit
              </button>
            ) : (
              <>
                <button onClick={() => { setEditWeights(false); setWeights(data!.weights) }} className="text-[9px] px-2 py-1 rounded bg-surface text-text-muted hover:text-text">
                  Cancel
                </button>
                <button onClick={saveWeights} disabled={saving} className="flex items-center gap-1 text-[9px] px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30">
                  <Save size={10} /> Save
                </button>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {weights && Object.entries(weightLabels).map(([key, info]) => (
            <div key={key} className="flex items-center justify-between p-2 rounded bg-white/5">
              <div>
                <div className="text-[10px] text-text">{info.label}</div>
                <div className="text-[8px] text-text-muted">{info.sub}</div>
              </div>
              {editWeights ? (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={weights[key as keyof Weights]}
                  onChange={(e) => setWeights({ ...weights, [key]: parseFloat(e.target.value) || 0 })}
                  className="w-16 text-right text-[10px] bg-surface border border-white/10 rounded px-1 py-0.5 text-text font-mono"
                />
              ) : (
                <span className="text-[10px] font-mono tabular-nums text-text">{(weights[key as keyof Weights] * 100).toFixed(0)}%</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* History */}
      {data?.history && data.history.length > 0 && (
        <Card className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-xs font-semibold text-text">Production History</div>
              <div className="text-[9px] text-text-muted">생산 이력</div>
            </div>
            <button
              onClick={() => setExpandedHistory(!expandedHistory)}
              className="text-[9px] px-2 py-1 rounded bg-surface text-text-muted hover:text-text"
            >
              {expandedHistory ? 'Show Less' : `Show All (${data.history.length})`}
            </button>
          </div>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-text-muted border-b border-white/5">
                  <th className="text-left py-1 pr-2">Date</th>
                  <th className="text-left px-1">Strategy</th>
                  <th className="text-left px-1">Action</th>
                  <th className="text-left px-1">From</th>
                  <th className="text-left px-1">To</th>
                  <th className="text-left pl-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {(expandedHistory ? data.history : data.history.slice(0, 10)).map((h, i) => (
                  <tr key={h.id ?? i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-1 pr-2 text-text-muted font-mono whitespace-nowrap">
                      {h.created_at ? new Date(h.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="px-1 text-text font-medium">{h.name || `#${h.strategy_id}`}</td>
                    <td className="px-1">
                      <span className={`text-[9px] px-1 py-0.5 rounded ${h.action === 'promote' || h.action === 'promote_to_production' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {h.action}
                      </span>
                    </td>
                    <td className="px-1 text-text-muted">{h.from || '-'}</td>
                    <td className="px-1 text-text-muted">{h.to || '-'}</td>
                    <td className="pl-2 text-text-muted max-w-[120px] truncate">{h.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title ?? 'Confirm'}
        message={confirmAction?.message ?? ''}
        onConfirm={() => { confirmAction?.onConfirm(); setConfirmAction(null) }}
        onCancel={() => setConfirmAction(null)}
        variant={confirmAction?.variant}
      />
    </div>
  )
}
