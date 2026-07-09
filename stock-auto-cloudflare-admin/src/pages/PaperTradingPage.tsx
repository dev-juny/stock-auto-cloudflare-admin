import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../utils/api'
import { useToast } from '../components/common/Toast'
import { useAction } from '../hooks/useAction'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import {
  Wallet, TrendingUp, TrendingDown, RefreshCw, Play,
  CheckCircle, XCircle, Activity, LogOut, Pause, PlayCircle,
} from 'lucide-react'

interface PaperStatus {
  cash: number
  total_value: number
  invested: number
  positions_count: number
  total_trades: number
  total_pnl: number
  broker: string
}

interface Signal {
  ticker: string
  name: string
  signal: string
  price: number
  strategy_id: number
  generation: number
}

interface Position {
  id: number
  strategy_id: number
  ticker: string
  entry_price: number
  current_price: number
  quantity: number
  entry_date: string
  pnl_pct: number
  pnl_amt: number
  status: string
}

interface Trade {
  id: number
  strategy_id: number
  ticker: string
  action: string
  price: number
  quantity: number
  pnl_pct: number
  trade_date: string
  reason: string
}

export default function PaperTradingPage() {
  const [status, setStatus] = useState<PaperStatus | null>(null)
  const [signals, setSignals] = useState<Signal[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [paused, setPaused] = useState(false)
  const [execResult, setExecResult] = useState<string | null>(null)
  const [showTestExit, setShowTestExit] = useState(false)
  const [testExitPosId, setTestExitPosId] = useState<number | null>(null)
  const [testExitCondition, setTestExitCondition] = useState<string>('stop_loss')
  const [showSignals, setShowSignals] = useState(false)
  const [prevPnl, setPrevPnl] = useState<number | null>(null)
  const [pnlChange, setPnlChange] = useState<number | null>(null)
  const { toast } = useToast()
  const { loading: execLoading, execute } = useAction()
  const { loading: testExitLoading, execute: testExitExec } = useAction()
  const { loading: cycleLoading, execute: cycleExec } = useAction()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevPnlRef = useRef<number | null>(null)

  const loadAll = useCallback(async () => {
    try {
      setError(null)
      const [s, p, t] = await Promise.all([
        api.get<PaperStatus>('/api/paper-trading/status').catch(() => null),
        api.get<{ items: Position[] }>('/api/paper-trading/positions').catch(() => null),
        api.get<{ items: Trade[] }>('/api/paper-trading/trades').catch(() => null),
      ])
      if (s) {
        if (prevPnlRef.current !== null && prevPnlRef.current !== s.total_pnl) {
          setPnlChange(s.total_pnl - prevPnlRef.current)
          setTimeout(() => setPnlChange(null), 3000)
        }
        prevPnlRef.current = s.total_pnl
        setStatus(s)
      }
      if (p) setPositions(p.items || [])
      if (t) setTrades(t.items || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    if (!autoRefresh || paused) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(loadAll, 15000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh, paused, loadAll])

  async function togglePause() {
    const action = paused ? 'resume' : 'pause'
    try {
      await api.post(`/api/scheduler/jobs/paper-trading/${action}`)
      setPaused(!paused)
      toast(paused ? 'info' : 'warning', `Paper trading ${action}d`)
    } catch {
      toast('error', `Failed to ${action} paper trading`)
    }
  }

  async function generateAndExecute() {
    setShowSignals(true)
    const sig = await execute(
      async () => {
        const s = await api.post<{ signals: Signal[]; count: number }>('/api/paper-trading/signals')
        setSignals(s.signals || [])
        if ((s.signals || []).length > 0) {
          const r = await api.post<{ results: any[]; count: number }>('/api/paper-trading/execute', { signals: s.signals })
          return r
        }
        return s
      },
      'Signals generated & executed',
    )
    if (sig) loadAll()
  }

  async function runTestExit() {
    if (!testExitPosId) return
    await testExitExec(
      () => api.post<{ message?: string }>('/api/paper-trading/test-exit', {
        pos_id: testExitPosId,
        condition: testExitCondition,
      }),
      'Test exit completed',
    )
    setShowTestExit(false)
    loadAll()
  }

  async function runFullCycle() {
    await cycleExec(
      () => api.post<{ message?: string }>('/api/paper-trading/run-cycle'),
      'Full cycle completed',
    )
    loadAll()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="skeleton h-5 w-32" />
          <div className="skeleton h-5 w-20" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-surface-card rounded-2xl p-4 border border-surface-border">
              <div className="skeleton h-3 w-16 mb-2" />
              <div className="skeleton h-6 w-24" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <XCircle size={24} className="text-red-400" />
        <p className="text-xs text-text-muted">{error}</p>
        <button onClick={loadAll} className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">Paper Trading</h2>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${paused ? 'bg-amber-500/10 text-amber-400' : 'bg-green-500/10 text-green-400'}`}>
            {paused ? 'PAUSED' : 'ACTIVE'}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Mock Broker</span>
        </div>
      </div>

      {status && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-surface-card rounded-2xl p-4 border border-surface-border">
            <div className="flex items-center gap-1.5 text-text-muted mb-1">
              <Wallet size={14} />
              <span className="text-[10px] font-medium">Total Value</span>
            </div>
            <div className="text-lg font-bold text-text">₩{(status.total_value ?? 0).toLocaleString()}</div>
          </div>
          <div className="bg-surface-card rounded-2xl p-4 border border-surface-border">
            <div className="flex items-center gap-1.5 text-text-muted mb-1">
              <TrendingUp size={14} />
              <span className="text-[10px] font-medium">Cash</span>
            </div>
            <div className="text-lg font-bold text-blue-400">₩{(status.cash ?? 0).toLocaleString()}</div>
          </div>
          <div className="bg-surface-card rounded-2xl p-4 border border-surface-border">
            <div className="flex items-center gap-1.5 text-text-muted mb-1">
              <Activity size={14} />
              <span className="text-[10px] font-medium">Positions</span>
            </div>
            <div className="text-lg font-bold text-amber-400">{status.positions_count ?? 0}</div>
          </div>
          <div className="bg-surface-card rounded-2xl p-4 border border-surface-border">
            <div className="flex items-center gap-1.5 text-text-muted mb-1">
              <TrendingDown size={14} />
              <span className="text-[10px] font-medium">Total P&L</span>
            </div>
            <div className={`text-lg font-bold font-mono tabular-nums flex items-center gap-1 ${(status.total_pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(status.total_pnl ?? 0) >= 0 ? '+' : ''}₩{Math.abs(status.total_pnl ?? 0).toLocaleString()}
              {pnlChange !== null && (
                <span className={`text-[10px] ${(pnlChange ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'} animate-pulse`}>
                  {(pnlChange ?? 0) >= 0 ? '+' : ''}₩{Math.abs(pnlChange ?? 0).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={generateAndExecute} disabled={execLoading || paused}
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
          <Play size={12} /> {execLoading ? 'Running...' : 'Generate & Execute'}
        </button>
        <button onClick={runFullCycle} disabled={cycleLoading || paused}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-border text-text hover:bg-surface-hover transition-colors disabled:opacity-50">
          <RefreshCw size={12} /> {cycleLoading ? 'Running...' : 'Full Cycle'}
        </button>
        <button onClick={togglePause}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 font-medium hover:bg-amber-500/20 transition-colors">
          {paused ? <PlayCircle size={12} /> : <Pause size={12} />}
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button onClick={loadAll} className="p-2 text-text-muted hover:text-text transition-colors">
          <RefreshCw size={14} />
        </button>
        <label className="flex items-center gap-1.5 text-xs text-text-muted ml-2">
          <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)}
            className="rounded border-surface-border bg-surface text-primary focus:ring-primary/40" />
          Auto
        </label>
      </div>

      {execResult && (
        <div className={`text-xs px-3 py-2 rounded-lg ${execResult.startsWith('Error') ? 'bg-red-500/10 text-red-400' : 'bg-primary/10 text-primary'}`}>
          {execResult}
        </div>
      )}

      {signals.length > 0 && showSignals && (
        <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
          <div className="p-3 border-b border-surface-border flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Signals Generated ({signals.length})</h3>
            <button onClick={() => setShowSignals(false)} className="text-text-muted hover:text-text text-xs">Close</button>
          </div>
          <div className="divide-y divide-surface-border max-h-40 overflow-y-auto">
            {signals.map((sig, i) => (
              <div key={i} className="px-4 py-2 text-[11px] flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  sig.signal === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>{sig.signal}</span>
                <span className="text-text font-medium">{sig.name}</span>
                <span className="text-text-muted">{sig.ticker}</span>
                <span className="text-text-muted ml-auto">₩{sig.price.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open Positions */}
      <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
        <div className="p-3 border-b border-surface-border flex items-center gap-4">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Open Positions</h3>
          <span className="text-[10px] text-text-muted">{positions.filter(p => p.status === 'open').length} open</span>
          {positions.filter(p => p.status === 'open').length > 0 && (
            <button onClick={() => { setShowTestExit(true); setTestExitPosId(positions.find(p => p.status === 'open')?.id ?? null) }}
              className="ml-auto flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-warning/15 text-warning hover:bg-warning/25 transition-colors">
              <LogOut size={10} /> Test Exit
            </button>
          )}
        </div>
        {positions.filter(p => p.status === 'open').length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">No open positions</div>
        ) : (
          <div className="divide-y divide-surface-border">
            {positions.filter(p => p.status === 'open').map(p => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-text">{p.ticker}</span>
                    <span className="text-[10px] text-text-muted">S{p.strategy_id}</span>
                  </div>
                  <div className="text-[10px] text-text-muted mt-0.5">
                    Entry: ₩{p.entry_price.toLocaleString()} &middot; Qty: {p.quantity}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${p.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {p.pnl_pct >= 0 ? '+' : ''}{p.pnl_pct.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {p.pnl_amt >= 0 ? '+' : ''}₩{Math.abs(p.pnl_amt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Trades */}
      <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
        <div className="p-3 border-b border-surface-border">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Recent Trades</h3>
        </div>
        {trades.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">No trades yet</div>
        ) : (
          <div className="divide-y divide-surface-border max-h-60 overflow-y-auto">
            {trades.slice(0, 30).map(t => (
              <div key={t.id} className="px-4 py-2 text-[11px] flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  t.action === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>{t.action}</span>
                <span className="text-text font-medium">{t.ticker}</span>
                <span className="text-text-muted">₩{t.price.toLocaleString()} x {t.quantity}</span>
                {t.pnl_pct !== 0 && (
                  <span className={t.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}>{t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct.toFixed(2)}%</span>
                )}
                <span className="text-text-muted ml-auto">{t.reason || '-'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test Exit Dialog */}
      {showTestExit && (
        <ConfirmDialog
          open={true}
          title="Test Exit Condition"
          message={`Simulate exit for position #${testExitPosId}`}
          confirmLabel="Run Test"
          loading={testExitLoading}
          onConfirm={runTestExit}
          onCancel={() => setShowTestExit(false)}
        />
      )}
    </div>
  )
}
