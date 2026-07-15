import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../utils/api'
import { useToast } from '../components/common/Toast'
import { useAction } from '../hooks/useAction'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { Tooltip } from '../components/common/Tooltip'
import { findGlossary } from '../utils/glossary'
import { formatStockDisplay } from '../utils/format'
import {
  Wallet, TrendingUp, TrendingDown, RefreshCw, Play,
  CheckCircle, XCircle, Activity, LogOut, Pause, PlayCircle,
  Plus, Square, RotateCcw, ChevronDown, Settings, Save,
} from 'lucide-react'

interface PaperSession {
  id: number
  name: string
  initial_capital: number
  max_positions: number
  position_size: number
  commission_pct: number
  slippage_pct: number
  tax_pct: number
  auto_mode: boolean
  status: string
  final_cash?: number | null
  final_invested?: number | null
  final_total?: number | null
  started_at: string
  ended_at?: string | null
}

interface PaperStatus {
  session_id: number
  session_name: string
  session_status: string
  initial_capital: number
  cash: number
  total_value: number
  invested: number
  positions_count: number
  total_trades: number
  total_pnl: number
  unrealized_pnl: number
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

interface ScanSummary {
  strategies_scanned: number
  universe_total: number
  momentum_pass: number
  breakout_pass: number
  pullback_pass: number
  volume_fail: number
  risk_reject: number
  generated: number
}

interface Position {
  id: number
  strategy_id: number
  ticker: string
  name?: string
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
  name?: string
  action: string
  price: number
  quantity: number
  pnl_pct: number
  trade_date: string
  reason: string
}

const CAPITAL_OPTIONS = [1000000, 5000000, 10000000, 50000000, 100000000]
const POSITION_SIZE_OPTIONS = [100000, 300000, 500000, 1000000, 2000000]
const MAX_POSITIONS_OPTIONS = [3, 5, 10, 20, 50]

export default function PaperTradingPage() {
  const [sessions, setSessions] = useState<PaperSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<number>(1)
  const [status, setStatus] = useState<PaperStatus | null>(null)
  const [signals, setSignals] = useState<Signal[]>([])
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [execResult, setExecResult] = useState<string | null>(null)
  const [showTestExit, setShowTestExit] = useState(false)
  const [testExitPosId, setTestExitPosId] = useState<number | null>(null)
  const [testExitCondition, setTestExitCondition] = useState<string>('stop_loss')
  const [showSignals, setShowSignals] = useState(false)
  const [prevPnl, setPrevPnl] = useState<number | null>(null)
  const [pnlChange, setPnlChange] = useState<number | null>(null)
  const [showNewSession, setShowNewSession] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false)
  const [schedulerStatus, setSchedulerStatus] = useState<string>('unknown')
  const [newSession, setNewSession] = useState({
    name: '',
    initial_capital: 10000000,
    max_positions: 5,
    position_size: 500000,
    commission_pct: 0,
    slippage_pct: 0,
    tax_pct: 0,
    auto_mode: false,
    custom_capital: false,
    custom_capital_value: '',
    custom_position_size: false,
    custom_position_size_value: '',
  })
  const { toast } = useToast()
  const { loading: execLoading, execute } = useAction()
  const { loading: testExitLoading, execute: testExitExec } = useAction()
  const { loading: cycleLoading, execute: cycleExec } = useAction()
  const { loading: resetLoading, execute: resetExec } = useAction()
  const { loading: stopLoading, execute: stopExec } = useAction()
  const { loading: newSessionLoading, execute: newSessionExec } = useAction()
  const { loading: pauseLoading, execute: pauseExec } = useAction()
  const { loading: resumeLoading, execute: resumeExec } = useAction()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevPnlRef = useRef<number | null>(null)

  const apiPrefix = useCallback((path: string) => {
    return `${path}${path.includes('?') ? '&' : '?'}session_id=${currentSessionId}`
  }, [currentSessionId])

  const loadSchedulerStatus = useCallback(async () => {
    try {
      const res = await api.get<{ status: string }>('/api/scheduler/jobs/paper-trading/status')
      setSchedulerStatus(res.status)
    } catch {
      try {
        const schedRes = await api.get<{ running: boolean; jobs: any[] }>('/api/scheduler/status')
        const ptJob = (schedRes.jobs || []).find((j: any) => j.job_id === 'paper-trading')
        setSchedulerStatus(ptJob?.status === 'PAUSED' ? 'paused' : 'running')
      } catch {
        setSchedulerStatus('unknown')
      }
    }
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      const res = await api.get<{ items: PaperSession[] }>('/api/paper-trading/sessions')
      setSessions(res.items || [])
    } catch {}
  }, [])

  const loadAll = useCallback(async () => {
    try {
      setError(null)
      const [s, p, t] = await Promise.all([
        api.get<PaperStatus>(apiPrefix('/api/paper-trading/status')).catch(() => null),
        api.get<{ items: Position[] }>(apiPrefix('/api/paper-trading/positions')).catch(() => null),
        api.get<{ items: Trade[] }>(apiPrefix('/api/paper-trading/trades')).catch(() => null),
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
  }, [apiPrefix])

  useEffect(() => {
    loadSchedulerStatus()
    loadSessions().then(() => loadAll())
  }, [loadSessions, loadAll, loadSchedulerStatus])

  useEffect(() => {
    if (!autoRefresh) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(loadAll, 15000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh, loadAll])

  const currentSession = sessions.find(s => s.id === currentSessionId)

  async function handleCreateSession() {
    await newSessionExec(
      async () => {
        const payload: any = {
          name: newSession.name || `Session #${sessions.length + 1}`,
          initial_capital: newSession.custom_capital
            ? parseInt(newSession.custom_capital_value) || 10000000
            : newSession.initial_capital,
          max_positions: newSession.max_positions,
          position_size: newSession.custom_position_size
            ? parseInt(newSession.custom_position_size_value) || 500000
            : newSession.position_size,
          commission_pct: (newSession.commission_pct as any) === '' ? 0 : newSession.commission_pct,
          slippage_pct: (newSession.slippage_pct as any) === '' ? 0 : newSession.slippage_pct,
          tax_pct: (newSession.tax_pct as any) === '' ? 0 : newSession.tax_pct,
          auto_mode: newSession.auto_mode,
        }
        const sess = await api.post<PaperSession>('/api/paper-trading/sessions', payload)
        setCurrentSessionId(sess.id)
        setShowNewSession(false)
        setNewSession({
          name: '', initial_capital: 10000000, max_positions: 5, position_size: 500000,
          commission_pct: 0, slippage_pct: 0, tax_pct: 0, auto_mode: false,
          custom_capital: false, custom_capital_value: '',
          custom_position_size: false, custom_position_size_value: '',
        })
        return sess
      },
      'Session created',
    )
    await loadSessions()
    await loadAll()
  }

  async function handleResetSession() {
    await resetExec(
      () => api.post(`/api/paper-trading/sessions/${currentSessionId}/reset`),
      'Session reset',
    )
    setShowResetConfirm(false)
    setSignals([])
    setScanSummary(null)
    setShowSignals(false)
    await loadAll()
  }

  async function handleStopSession() {
    await stopExec(
      () => api.post(`/api/paper-trading/sessions/${currentSessionId}/stop`),
      'Session stopped',
    )
    setShowStopConfirm(false)
    await loadSessions()
    await loadAll()
  }

  async function selectSession(id: number) {
    setCurrentSessionId(id)
    setSessionMenuOpen(false)
    setSignals([])
    setScanSummary(null)
    setShowSignals(false)
    setLoading(true)
    await loadAll()
  }

  async function generateAndExecute() {
    setShowSignals(true)
    const sig = await execute(
      async () => {
        const s = await api.post<{ signals: Signal[]; count: number; scan_summary: ScanSummary }>(
          apiPrefix('/api/paper-trading/signals')
        )
        setSignals(s.signals || [])
        setScanSummary(s.scan_summary || null)
        if ((s.signals || []).length > 0) {
          const r = await api.post<{ results: any[]; count: number }>(
            apiPrefix('/api/paper-trading/execute'),
            { signals: s.signals }
          )
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
      () => api.post<{ message?: string }>(apiPrefix('/api/paper-trading/test-exit'), {
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
      () => api.post(apiPrefix('/api/paper-trading/run-cycle')),
      'Full cycle completed',
    )
    loadAll()
  }

  async function handlePauseScheduler() {
    await pauseExec(
      () => api.post('/api/scheduler/jobs/paper-trading/pause'),
      'Scheduler paused',
    )
    setSchedulerStatus('paused')
  }

  async function handleResumeScheduler() {
    await resumeExec(
      () => api.post('/api/scheduler/jobs/paper-trading/resume'),
      'Scheduler resumed',
    )
    setSchedulerStatus('running')
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
      {/* Session Selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <button
            onClick={() => setSessionMenuOpen(!sessionMenuOpen)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-card border border-surface-border text-text hover:bg-surface-hover transition-colors"
          >
            <PlayCircle size={12} className="text-primary" />
            <span className="font-medium">{currentSession?.name || `Session #${currentSessionId}`}</span>
            <ChevronDown size={12} className="text-text-muted" />
          </button>
          {sessionMenuOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-surface-card border border-surface-border rounded-xl shadow-xl min-w-[200px] max-h-60 overflow-y-auto">
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => selectSession(s.id)}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-surface-hover transition-colors ${
                    s.id === currentSessionId ? 'bg-primary/10 text-primary' : 'text-text'
                  } ${s.status !== 'active' ? 'opacity-60' : ''}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'active' ? 'bg-green-400' : 'bg-text-muted'}`} />
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-auto text-[10px] text-text-muted">
                    {s.status === 'active' ? 'Active' : s.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-text-muted">
          <span className={`px-1.5 py-0.5 rounded-full ${
            status?.session_status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
          }`}>
            {status?.session_status === 'active' ? 'ACTIVE' : status?.session_status?.toUpperCase()}
          </span>
          <span className={`px-1.5 py-0.5 rounded-full ${
            schedulerStatus === 'running' ? 'bg-green-500/10 text-green-400' :
            schedulerStatus === 'paused' ? 'bg-amber-500/10 text-amber-400' :
            'bg-text-muted/10 text-text-muted'
          }`}>
            {schedulerStatus === 'running' ? 'SCHEDULER RUNNING' :
             schedulerStatus === 'paused' ? 'SCHEDULER PAUSED' : 'SCHEDULER UNKNOWN'}
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Mock Broker</span>
        </div>
      </div>

      {/* Status Cards */}
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
              <Tooltip content={findGlossary('maxPositions')?.description ?? 'Positions'}>
                <span className="text-[10px] font-medium">Positions</span>
              </Tooltip>
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

      {/* Session Summary (when stopped) */}
      {status?.session_status !== 'active' && currentSession && (currentSession.final_total != null) && (
        <div className="bg-surface-card rounded-2xl p-4 border border-surface-border">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Session Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
            <div>
              <span className="text-text-muted">Initial Capital</span>
              <div className="text-text font-medium">₩{(currentSession.initial_capital ?? 0).toLocaleString()}</div>
            </div>
            <div>
              <span className="text-text-muted">Final Total</span>
              <div className="text-text font-medium">₩{(currentSession.final_total ?? 0).toLocaleString()}</div>
            </div>
            <div>
              <span className="text-text-muted">Return</span>
              <div className={`font-medium ${((currentSession.final_total ?? 0) - (currentSession.initial_capital ?? 0)) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {((((currentSession.final_total ?? 0) - (currentSession.initial_capital ?? 0)) / (currentSession.initial_capital ?? 1)) * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <span className="text-text-muted">Ended</span>
              <div className="text-text font-medium">{currentSession.ended_at ? new Date(currentSession.ended_at).toLocaleDateString() : '-'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setShowNewSession(true)}
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors">
          <Plus size={12} /> New Paper Trading
        </button>
        {status?.session_status === 'active' && (
          <>
            <button onClick={generateAndExecute} disabled={execLoading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-border text-text hover:bg-surface-hover transition-colors disabled:opacity-50">
              <Play size={12} /> {execLoading ? 'Running...' : 'Generate & Execute'}
            </button>
            <button onClick={runFullCycle} disabled={cycleLoading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-border text-text hover:bg-surface-hover transition-colors disabled:opacity-50">
              <RefreshCw size={12} /> {cycleLoading ? 'Running...' : 'Full Cycle'}
            </button>
            <button onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
              <RotateCcw size={12} /> Reset
            </button>
            <button onClick={() => setShowStopConfirm(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors">
              <Square size={12} /> Stop
            </button>
            {schedulerStatus === 'running' ? (
              <button onClick={handlePauseScheduler} disabled={pauseLoading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-warning/15 text-warning hover:bg-warning/25 transition-colors disabled:opacity-50">
                <Pause size={12} /> {pauseLoading ? 'Pausing...' : 'Pause Scheduler'}
              </button>
            ) : (
              <button onClick={handleResumeScheduler} disabled={resumeLoading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50">
                <PlayCircle size={12} /> {resumeLoading ? 'Resuming...' : 'Resume Scheduler'}
              </button>
            )}
          </>
        )}
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

      {/* Scan Summary */}
      {scanSummary && showSignals && (
        <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
          <div className="p-3 border-b border-surface-border">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Signal Scan Summary</h3>
          </div>
          <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
            <div>
              <span className="text-text-muted">Strategies Scanned</span>
              <div className="text-text font-medium">{scanSummary.strategies_scanned}</div>
            </div>
            <div>
              <span className="text-text-muted">Universe Total</span>
              <div className="text-text font-medium">{scanSummary.universe_total}</div>
            </div>
            <div>
              <span className="text-text-muted">Momentum Pass</span>
              <div className="text-green-400 font-medium">{scanSummary.momentum_pass}</div>
            </div>
            <div>
              <span className="text-text-muted">Breakout Pass</span>
              <div className="text-blue-400 font-medium">{scanSummary.breakout_pass}</div>
            </div>
            <div>
              <span className="text-text-muted">Pullback Pass</span>
              <div className="text-purple-400 font-medium">{scanSummary.pullback_pass}</div>
            </div>
            <div>
              <span className="text-text-muted">Volume Fail</span>
              <div className="text-text-muted font-medium">{scanSummary.volume_fail}</div>
            </div>
            <div>
              <span className="text-text-muted">Risk Reject</span>
              <div className="text-amber-400 font-medium">{scanSummary.risk_reject}</div>
            </div>
            <div>
              <span className="text-text-muted">Signals Generated</span>
              <div className={`font-bold ${scanSummary.generated > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {scanSummary.generated}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signals Generated (only when there are signals) */}
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

      {/* No signals info */}
      {scanSummary && scanSummary.generated === 0 && showSignals && (
        <div className="bg-surface-card rounded-2xl border border-surface-border p-4 text-center text-xs text-text-muted">
          No buy signals generated. Check scan summary above for details.
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
                    <span className="text-sm font-medium text-text">{formatStockDisplay(p.name, p.ticker)}</span>
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
                <span className="text-text font-medium">{formatStockDisplay(t.name, t.ticker)}</span>
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

      {/* Reset Confirm */}
      <ConfirmDialog
        open={showResetConfirm}
        title="Reset Session"
        message={`Reset session "${currentSession?.name || `#${currentSessionId}`}"? All positions, trades, and signals will be cleared.`}
        confirmLabel="Reset"
        variant="danger"
        loading={resetLoading}
        onConfirm={handleResetSession}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Stop Confirm */}
      <ConfirmDialog
        open={showStopConfirm}
        title="Stop Session"
        message={`End session "${currentSession?.name || `#${currentSessionId}`}"? Open positions will be closed.`}
        confirmLabel="Stop"
        variant="danger"
        loading={stopLoading}
        onConfirm={handleStopSession}
        onCancel={() => setShowStopConfirm(false)}
      />

      {/* New Session Modal */}
      {showNewSession && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setShowNewSession(false)}>
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 max-w-lg w-full mx-3 shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                <Settings size={16} className="text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-text">New Paper Trading Session</h3>
              <button onClick={() => setShowNewSession(false)} className="ml-auto text-text-muted hover:text-text">
                <XCircle size={14} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Session Name */}
              <div>
                <label className="text-[11px] font-medium text-text-muted mb-1 block">Session Name</label>
                <input type="text" value={newSession.name} onChange={e => setNewSession({...newSession, name: e.target.value})}
                  placeholder={`Session #${sessions.length + 1}`}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-surface border border-surface-border text-text placeholder-text-muted focus:outline-none focus:border-primary/50" />
              </div>

              {/* Initial Capital */}
              <div>
                <label className="text-[11px] font-medium text-text-muted mb-1 block">Initial Capital</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {CAPITAL_OPTIONS.map(v => (
                    <button key={v} onClick={() => setNewSession({...newSession, initial_capital: v, custom_capital: false, custom_capital_value: ''})}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                        !newSession.custom_capital && newSession.initial_capital === v
                          ? 'bg-primary/15 text-primary border-primary/30'
                          : 'bg-surface border-surface-border text-text-muted hover:border-text-muted'
                      }`}>
                      ₩{v.toLocaleString()}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={newSession.custom_capital}
                    onChange={e => setNewSession({...newSession, custom_capital: e.target.checked})}
                    className="rounded border-surface-border bg-surface text-primary focus:ring-primary/40" />
                  <span className="text-[10px] text-text-muted">Custom</span>
                  {newSession.custom_capital && (
                    <input type="number" value={newSession.custom_capital_value}
                      onChange={e => setNewSession({...newSession, custom_capital_value: e.target.value})}
                      placeholder="Enter amount"
                      className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-text placeholder-text-muted focus:outline-none focus:border-primary/50" />
                  )}
                </div>
              </div>

              {/* Position Size */}
              <div>
                <label className="text-[11px] font-medium text-text-muted mb-1 block">Position Size (Max per trade)</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {POSITION_SIZE_OPTIONS.map(v => (
                    <button key={v} onClick={() => setNewSession({...newSession, position_size: v, custom_position_size: false, custom_position_size_value: ''})}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                        !newSession.custom_position_size && newSession.position_size === v
                          ? 'bg-primary/15 text-primary border-primary/30'
                          : 'bg-surface border-surface-border text-text-muted hover:border-text-muted'
                      }`}>
                      ₩{v.toLocaleString()}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={newSession.custom_position_size}
                    onChange={e => setNewSession({...newSession, custom_position_size: e.target.checked})}
                    className="rounded border-surface-border bg-surface text-primary focus:ring-primary/40" />
                  <span className="text-[10px] text-text-muted">Custom</span>
                  {newSession.custom_position_size && (
                    <input type="number" value={newSession.custom_position_size_value}
                      onChange={e => setNewSession({...newSession, custom_position_size_value: e.target.value})}
                      placeholder="Enter amount"
                      className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-text placeholder-text-muted focus:outline-none focus:border-primary/50" />
                  )}
                </div>
              </div>

              {/* Max Positions */}
              <div>
                <label className="text-[11px] font-medium text-text-muted mb-1 block">Max Positions</label>
                <div className="flex flex-wrap gap-1.5">
                  {MAX_POSITIONS_OPTIONS.map(v => (
                    <button key={v} onClick={() => setNewSession({...newSession, max_positions: v})}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                        newSession.max_positions === v
                          ? 'bg-primary/15 text-primary border-primary/30'
                          : 'bg-surface border-surface-border text-text-muted hover:border-text-muted'
                      }`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto Mode */}
              <div>
                <label className="flex items-center gap-2 text-xs text-text cursor-pointer">
                  <input type="checkbox" checked={newSession.auto_mode}
                    onChange={e => setNewSession({...newSession, auto_mode: e.target.checked})}
                    className="rounded border-surface-border bg-surface text-primary focus:ring-primary/40" />
                  Auto Cycle (run automatically every hour during market hours)
                </label>
              </div>

              {/* Commission, Slippage, Tax */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-text-muted mb-1 block">Commission (%)</label>
                  <input type="number" value={newSession.commission_pct} step="0.01"
                    onChange={e => { const r = e.target.value; setNewSession({...newSession, commission_pct: r === '' ? ('' as any) : (parseFloat(r) || 0) })}}
                    className="w-full text-xs px-2 py-1.5 rounded-lg bg-surface border border-surface-border text-text focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-text-muted mb-1 block">Slippage (%)</label>
                  <input type="number" value={newSession.slippage_pct} step="0.01"
                    onChange={e => { const r = e.target.value; setNewSession({...newSession, slippage_pct: r === '' ? ('' as any) : (parseFloat(r) || 0) })}}
                    className="w-full text-xs px-2 py-1.5 rounded-lg bg-surface border border-surface-border text-text focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-text-muted mb-1 block">Tax (%)</label>
                  <input type="number" value={newSession.tax_pct} step="0.01"
                    onChange={e => { const r = e.target.value; setNewSession({...newSession, tax_pct: r === '' ? ('' as any) : (parseFloat(r) || 0) })}}
                    className="w-full text-xs px-2 py-1.5 rounded-lg bg-surface border border-surface-border text-text focus:outline-none focus:border-primary/50" />
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end pt-2 border-t border-surface-border">
                <button onClick={() => setShowNewSession(false)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-surface-border text-text-muted hover:text-text transition-colors">
                  Cancel
                </button>
                <button onClick={handleCreateSession} disabled={newSessionLoading}
                  className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                  <Save size={12} /> {newSessionLoading ? 'Creating...' : 'Create Session'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
