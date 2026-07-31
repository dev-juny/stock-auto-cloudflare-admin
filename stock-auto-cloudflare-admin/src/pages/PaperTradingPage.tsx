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
  Plus, Square, RotateCcw, ChevronDown, Settings, Save, Trash2, Lock,
} from 'lucide-react'
import { createChart, ColorType, LineSeries } from 'lightweight-charts'

interface RiskCheckBrief {
  max_position_allocation: number
  single_asset_ratio: number
  highest_concentration_ticker: string
  blocked: boolean
}

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
  current_position_value: number
  positions_count: number
  total_trades: number
  total_pnl: number
  realized_pnl: number
  unrealized_pnl: number
  broker: string
  total_return_pct: number
  winning_positions: number
  losing_positions: number
  win_rate: number
  best_position: { ticker: string; name: string; pnl_pct: number; pnl_amt: number } | null
  worst_position: { ticker: string; name: string; pnl_pct: number; pnl_amt: number } | null
  today_pnl: number
  today_return_pct: number
  invested_pct: number
  cash_pct: number
  realized_today: number
  unrealized_today: number
  portfolio_value: number
  invested_amount: number
  today_buy_count: number
  today_sell_count: number
  today_win_rate: number
  equity_curve: { time: string; value: number }[]
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
  exit_date?: string | null
  exit_price?: number | null
  highest_price?: number | null
  strategy_params?: Record<string, unknown> | null
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
  pnl_amt?: number
  trade_date: string
  reason: string
}

const CAPITAL_OPTIONS = [1000000, 5000000, 10000000, 50000000, 100000000]
const POSITION_SIZE_OPTIONS = [100000, 300000, 500000, 1000000, 2000000]
const MAX_POSITIONS_OPTIONS = [3, 5, 10, 20, 50]

export default function PaperTradingPage() {
  const [sessions, setSessions] = useState<PaperSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null)
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
  const [riskCheck, setRiskCheck] = useState<RiskCheckBrief | null>(null)
  const [showNewSession, setShowNewSession] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const { loading: deleteLoading, execute: deleteExec } = useAction()
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
  const { loading: autoCreateLoading, execute: autoCreateExec } = useAction()
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
      const list = res.items || []
      setSessions(list)
      if (list.length > 0) {
        const active = list.find(s => s.status === 'active')
        const targetId = active ? active.id : list[0].id
        setCurrentSessionId(prev => {
          if (prev && list.find(s => s.id === prev)) return prev
          return targetId
        })
      }
    } catch {}
  }, [])

  const loadAll = useCallback(async () => {
    if (currentSessionId === null) return
    try {
      setError(null)
      const [s, p, t, rc] = await Promise.all([
        api.get<PaperStatus>(apiPrefix('/api/paper-trading/status')).catch(() => null),
        api.get<{ items: Position[] }>(apiPrefix('/api/paper-trading/positions')).catch(() => null),
        api.get<{ items: Trade[] }>(apiPrefix('/api/paper-trading/trades')).catch(() => null),
        api.get<RiskCheckBrief>('/api/risk/check').catch(() => null),
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
      if (rc) setRiskCheck(rc)
    } catch (e: any) {
      setError(e.message || '데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [apiPrefix])

  useEffect(() => {
    loadSchedulerStatus()
    loadSessions()
  }, [loadSchedulerStatus, loadSessions])

  useEffect(() => {
    if (currentSessionId) {
      loadAll()
    }
  }, [currentSessionId, loadAll])

  useEffect(() => {
    if (!autoRefresh) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(loadAll, 15000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh, loadAll])

  const currentSession = sessions.find(s => s.id === currentSessionId)
  const openPositions = positions.filter(p => p.status === 'open')
  const closedPositions = positions.filter(p => p.status === 'closed')
  const [positionTab, setPositionTab] = useState<'open' | 'closed'>('open')

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
      '세션이 생성되었습니다',
    )
    await loadSessions()
    await loadAll()
  }

  async function handleAutoCreate() {
    await autoCreateExec(
      async () => {
        const res = await api.post(`/api/paper-trading/auto-create?count=5&capital=10000000&max_positions=10`)
        return res
      },
      `${5}개 세션이 자동 생성되었습니다`,
    )
    await loadSessions()
  }

  async function handleResetSession() {
    await resetExec(
      () => api.post(`/api/paper-trading/sessions/${currentSessionId}/reset`),
      '세션이 초기화되었습니다',
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
      '세션이 중지되었습니다',
    )
    setShowStopConfirm(false)
    await loadSessions()
    await loadAll()
  }

  async function handleDeleteSession() {
    if (deleteTargetId === null) return
    await deleteExec(
      () => api.delete(`/api/paper-trading/sessions/${deleteTargetId}`),
      '세션이 삭제되었습니다',
    )
    setShowDeleteConfirm(false)
    setDeleteTargetId(null)
    if (currentSessionId === deleteTargetId) {
      const remaining = sessions.filter(s => s.id !== deleteTargetId)
      if (remaining.length > 0) setCurrentSessionId(remaining[0].id)
    }
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
      '신호 생성 및 실행 완료',
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
      '테스트 청산 완료',
    )
    setShowTestExit(false)
    loadAll()
  }

  async function runFullCycle() {
    await cycleExec(
      () => api.post(apiPrefix('/api/paper-trading/run-cycle')),
      '전체 사이클 완료',
    )
    loadAll()
  }

  async function handlePauseScheduler() {
    await pauseExec(
      () => api.post('/api/scheduler/jobs/paper-trading/pause'),
      '스케줄러 일시 정지됨',
    )
    setSchedulerStatus('paused')
  }

  async function handleResumeScheduler() {
    await resumeExec(
      () => api.post('/api/scheduler/jobs/paper-trading/resume'),
      '스케줄러 재개됨',
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
          재시도
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
            <span className="font-medium">{currentSession?.name || `세션 #${currentSessionId}`}</span>
            <ChevronDown size={12} className="text-text-muted" />
          </button>
          {sessionMenuOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-surface-card border border-surface-border rounded-xl shadow-xl min-w-[200px] max-h-60 overflow-y-auto">
              {sessions.map(s => (
                <div
                  key={s.id}
                  className={`flex items-center px-3 py-2 text-xs hover:bg-surface-hover transition-colors ${
                    s.id === currentSessionId ? 'bg-primary/10 text-primary' : 'text-text'
                  } ${s.status !== 'active' ? 'opacity-60' : ''}`}
                >
                  <button
                    onClick={() => selectSession(s.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'active' ? 'bg-green-400' : 'bg-text-muted'}`} />
                    <span className="font-medium">{s.name}</span>
                    <span className="ml-auto text-[10px] text-text-muted">
                      {s.status === 'active' ? '활성' : s.status}
                    </span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTargetId(s.id); setShowDeleteConfirm(true); }}
                    className="ml-2 p-1 rounded-md hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                    title="세션 삭제"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-text-muted">
          <span className={`px-1.5 py-0.5 rounded-full ${
            status?.session_status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
          }`}>
            {status?.session_status === 'active' ? '활성' : (status?.session_status ?? '').toUpperCase()}
          </span>
          <span className={`px-1.5 py-0.5 rounded-full ${
            schedulerStatus === 'running' ? 'bg-green-500/10 text-green-400' :
            schedulerStatus === 'paused' ? 'bg-amber-500/10 text-amber-400' :
            'bg-text-muted/10 text-text-muted'
          }`}>
            {schedulerStatus === 'running' ? '스케줄러 실행 중' :
             schedulerStatus === 'paused' ? '스케줄러 일시 정지' : '스케줄러 알 수 없음'}
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400">모의 브로커</span>
        </div>
      </div>

      {/* Status Cards */}
      {status && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-surface-card rounded-2xl p-4 border border-surface-border">
            <div className="flex items-center gap-1.5 text-text-muted mb-1">
              <Wallet size={14} />
              <span className="text-[10px] font-medium">총 자산</span>
            </div>
            <div className="text-lg font-bold text-text">₩{(status.total_value ?? 0).toLocaleString()}</div>
          </div>
          <div className="bg-surface-card rounded-2xl p-4 border border-surface-border">
            <div className="flex items-center gap-1.5 text-text-muted mb-1">
              <TrendingUp size={14} />
              <span className="text-[10px] font-medium">현금</span>
            </div>
            <div className="text-lg font-bold text-blue-400">₩{(status.cash ?? 0).toLocaleString()}</div>
          </div>
          <div className="bg-surface-card rounded-2xl p-4 border border-surface-border">
            <div className="flex items-center gap-1.5 text-text-muted mb-1">
              <Activity size={14} />
              <Tooltip content={findGlossary('maxPositions')?.description ?? '포지션'}>
                <span className="text-[10px] font-medium">포지션</span>
              </Tooltip>
            </div>
            <div className="text-lg font-bold text-amber-400">{status.positions_count ?? 0}</div>
          </div>
          <div className="bg-surface-card rounded-2xl p-4 border border-surface-border">
            <div className="flex items-center gap-1.5 text-text-muted mb-1">
              <TrendingDown size={14} />
              <span className="text-[10px] font-medium">총 손익</span>
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
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">세션 요약</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
            <div>
              <span className="text-text-muted">초기 자본</span>
              <div className="text-text font-medium">₩{(currentSession.initial_capital ?? 0).toLocaleString()}</div>
            </div>
            <div>
              <span className="text-text-muted">최종 자산</span>
              <div className="text-text font-medium">₩{(currentSession.final_total ?? 0).toLocaleString()}</div>
            </div>
            <div>
              <span className="text-text-muted">수익률</span>
              <div className={`font-medium ${((currentSession.final_total ?? 0) - (currentSession.initial_capital ?? 0)) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {((((currentSession.final_total ?? 0) - (currentSession.initial_capital ?? 0)) / (currentSession.initial_capital ?? 1)) * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <span className="text-text-muted">종료일</span>
              <div className="text-text font-medium">{currentSession.ended_at ? new Date(currentSession.ended_at).toLocaleDateString() : '-'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Summary */}
      {status && (
        <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
          <div className="p-3 border-b border-surface-border">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">포트폴리오 요약</h3>
          </div>
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
            <div className="bg-surface rounded-xl p-3">
              <div className="text-text-muted mb-0.5">총 수익률</div>
              <div className={`text-sm font-bold font-mono tabular-nums ${(status.total_return_pct ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(status.total_return_pct ?? 0) >= 0 ? '+' : ''}{(status.total_return_pct ?? 0).toFixed(2)}%
              </div>
              <div className={`text-[10px] font-mono ${((status.total_pnl ?? 0) + (status.unrealized_pnl ?? 0)) >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                {((status.total_pnl ?? 0) + (status.unrealized_pnl ?? 0)) >= 0 ? '+' : ''}₩{Math.abs((status.total_pnl ?? 0) + (status.unrealized_pnl ?? 0)).toLocaleString()}
              </div>
            </div>
            <div className="bg-surface rounded-xl p-3">
              <div className="text-text-muted mb-0.5">승률</div>
              <div className="text-sm font-bold font-mono tabular-nums text-text">{(status.win_rate ?? 0).toFixed(1)}%</div>
              <div className="text-[10px] text-text-muted">
                {status.winning_positions}승 {status.losing_positions}패
              </div>
            </div>
            <div className="bg-surface rounded-xl p-3">
              <div className="text-text-muted mb-0.5">오늘 손익</div>
              <div className={`text-sm font-bold font-mono tabular-nums ${(status.today_pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(status.today_pnl ?? 0) >= 0 ? '+' : ''}₩{Math.abs(status.today_pnl ?? 0).toLocaleString()}
              </div>
              <div className={`text-[10px] font-mono ${(status.today_return_pct ?? 0) >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                {(status.today_return_pct ?? 0) >= 0 ? '+' : ''}{(status.today_return_pct ?? 0).toFixed(2)}%
              </div>
            </div>
            <div className="bg-surface rounded-xl p-3">
              <div className="text-text-muted mb-0.5">자산 배분</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-surface-border overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${status.invested_pct ?? 0}%` }} />
                </div>
                <span className="text-[10px] font-mono text-text">{(status.invested_pct ?? 0).toFixed(1)}%</span>
              </div>
              <div className="text-[10px] text-text-muted mt-1 flex justify-between">
                <span>투자: ₩{(status.invested ?? 0).toLocaleString()}</span>
                <span>현금: ₩{(status.cash ?? 0).toLocaleString()}</span>
              </div>
            </div>
            <div className="bg-surface rounded-xl p-3">
              <div className="text-text-muted mb-0.5">최고 포지션</div>
              {status.best_position ? (
                <>
                  <div className="text-xs font-medium text-text truncate">{status.best_position.name || status.best_position.ticker}</div>
                  <div className="text-[10px] font-mono text-green-400">
                    +{status.best_position.pnl_pct.toFixed(2)}% ₩+{Math.abs(status.best_position.pnl_amt).toLocaleString()}
                  </div>
                </>
              ) : (
                <div className="text-[10px] text-text-muted">-</div>
              )}
            </div>
            <div className="bg-surface rounded-xl p-3">
              <div className="text-text-muted mb-0.5">최저 포지션</div>
              {status.worst_position ? (
                <>
                  <div className="text-xs font-medium text-text truncate">{status.worst_position.name || status.worst_position.ticker}</div>
                  <div className={`text-[10px] font-mono ${status.worst_position.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {status.worst_position.pnl_pct >= 0 ? '+' : ''}{status.worst_position.pnl_pct.toFixed(2)}% {status.worst_position.pnl_amt >= 0 ? '+' : ''}₩{Math.abs(status.worst_position.pnl_amt).toLocaleString()}
                  </div>
                </>
              ) : (
                <div className="text-[10px] text-text-muted">-</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setShowNewSession(true)}
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors">
          <Plus size={12} /> 새 모의투자
        </button>
        <button onClick={handleAutoCreate} disabled={autoCreateLoading}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-surface-border text-text hover:bg-surface-hover transition-colors disabled:opacity-50">
          <PlayCircle size={12} /> {autoCreateLoading ? '생성 중...' : '자동 세션 생성'}
        </button>
        {status?.session_status === 'active' && (
          <>
            <button onClick={generateAndExecute} disabled={execLoading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-border text-text hover:bg-surface-hover transition-colors disabled:opacity-50">
              <Play size={12} /> {execLoading ? '실행 중...' : '신호 생성 및 실행'}
            </button>
            <button onClick={runFullCycle} disabled={cycleLoading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-border text-text hover:bg-surface-hover transition-colors disabled:opacity-50">
              <RefreshCw size={12} /> {cycleLoading ? '실행 중...' : '전체 사이클'}
            </button>
            <button onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
              <RotateCcw size={12} /> 초기화
            </button>
            <button onClick={() => setShowStopConfirm(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors">
              <Square size={12} /> 중지
            </button>
            {schedulerStatus === 'running' ? (
              <button onClick={handlePauseScheduler} disabled={pauseLoading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-warning/15 text-warning hover:bg-warning/25 transition-colors disabled:opacity-50">
                <Pause size={12} /> {pauseLoading ? '일시 정지 중...' : '스케줄러 일시 정지'}
              </button>
            ) : (
              <button onClick={handleResumeScheduler} disabled={resumeLoading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50">
                <PlayCircle size={12} /> {resumeLoading ? '재개 중...' : '스케줄러 재개'}
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
          자동
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
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">신호 스캔 요약</h3>
          </div>
          <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
            <div>
              <span className="text-text-muted">스캔 전략 수</span>
              <div className="text-text font-medium">{scanSummary.strategies_scanned}</div>
            </div>
            <div>
              <span className="text-text-muted">전체 유니버스</span>
              <div className="text-text font-medium">{scanSummary.universe_total}</div>
            </div>
            <div>
              <span className="text-text-muted">모멘텀 통과</span>
              <div className="text-green-400 font-medium">{scanSummary.momentum_pass}</div>
            </div>
            <div>
              <span className="text-text-muted">돌파 통과</span>
              <div className="text-blue-400 font-medium">{scanSummary.breakout_pass}</div>
            </div>
            <div>
              <span className="text-text-muted">풀백 통과</span>
              <div className="text-purple-400 font-medium">{scanSummary.pullback_pass}</div>
            </div>
            <div>
              <span className="text-text-muted">거래량 실패</span>
              <div className="text-text-muted font-medium">{scanSummary.volume_fail}</div>
            </div>
            <div>
              <span className="text-text-muted">위험 거부</span>
              <div className="text-amber-400 font-medium">{scanSummary.risk_reject}</div>
            </div>
            <div>
              <span className="text-text-muted">생성된 신호</span>
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
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">생성된 신호 ({signals.length})</h3>
            <button onClick={() => setShowSignals(false)} className="text-text-muted hover:text-text text-xs">닫기</button>
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
          매수 신호가 생성되지 않았습니다. 위 스캔 요약을 확인하세요.
        </div>
      )}

      {/* Today's Performance */}
      {status && (
        <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
          <div className="p-3 border-b border-surface-border">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Today's Performance</h3>
          </div>
          <div className="p-3 space-y-3">
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {/* Today's Return */}
              <div className="bg-surface rounded-xl p-2.5">
                <div className="text-[10px] text-text-muted mb-0.5">Today Return</div>
                <div className={`text-sm font-bold font-mono tabular-nums ${(status.today_return_pct ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(status.today_return_pct ?? 0) >= 0 ? '+' : ''}{(status.today_return_pct ?? 0).toFixed(2)}%
                </div>
              </div>
              {/* Today's P&L */}
              <div className="bg-surface rounded-xl p-2.5">
                <div className="text-[10px] text-text-muted mb-0.5">Today's P&amp;L</div>
                <div className={`text-sm font-bold font-mono tabular-nums ${(status.today_pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(status.today_pnl ?? 0) >= 0 ? '+' : ''}₩{Math.abs(status.today_pnl ?? 0).toLocaleString()}
                </div>
              </div>
              {/* Realized */}
              <div className="bg-surface rounded-xl p-2.5">
                <div className="text-[10px] text-text-muted mb-0.5">Realized</div>
                <div className={`text-sm font-bold font-mono tabular-nums ${(status.realized_today ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(status.realized_today ?? 0) >= 0 ? '+' : ''}₩{Math.abs(status.realized_today ?? 0).toLocaleString()}
                </div>
              </div>
              {/* Unrealized */}
              <div className="bg-surface rounded-xl p-2.5">
                <div className="text-[10px] text-text-muted mb-0.5">Unrealized</div>
                <div className={`text-sm font-bold font-mono tabular-nums ${(status.unrealized_today ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(status.unrealized_today ?? 0) >= 0 ? '+' : ''}₩{Math.abs(status.unrealized_today ?? 0).toLocaleString()}
                </div>
              </div>
              {/* Portfolio Value */}
              <div className="bg-surface rounded-xl p-2.5">
                <div className="text-[10px] text-text-muted mb-0.5">Portfolio Value</div>
                <div className="text-sm font-bold font-mono tabular-nums text-text">₩{(status.portfolio_value ?? 0).toLocaleString()}</div>
              </div>
              {/* Cash */}
              <div className="bg-surface rounded-xl p-2.5">
                <div className="text-[10px] text-text-muted mb-0.5">Cash</div>
                <div className="text-sm font-bold font-mono tabular-nums text-text">₩{(status.cash ?? 0).toLocaleString()}</div>
              </div>
              {/* Invested */}
              <div className="bg-surface rounded-xl p-2.5">
                <div className="text-[10px] text-text-muted mb-0.5">Invested</div>
                <div className="text-sm font-bold font-mono tabular-nums text-text">₩{(status.invested_amount ?? 0).toLocaleString()}</div>
              </div>
              {/* Open Positions */}
              <div className="bg-surface rounded-xl p-2.5">
                <div className="text-[10px] text-text-muted mb-0.5">Open Positions</div>
                <div className="text-sm font-bold font-mono tabular-nums text-amber-400">{status.positions_count ?? 0}</div>
              </div>
              {/* Today's Trades */}
              <div className="bg-surface rounded-xl p-2.5">
                <div className="text-[10px] text-text-muted mb-0.5">Today's Trades</div>
                <div className="text-xs font-mono">
                  <span className="text-green-400">BUY {status.today_buy_count ?? 0}</span>
                  <span className="text-text-muted mx-1">/</span>
                  <span className="text-red-400">SELL {status.today_sell_count ?? 0}</span>
                </div>
              </div>
              {/* Today Win Rate */}
              <div className="bg-surface rounded-xl p-2.5">
                <div className="text-[10px] text-text-muted mb-0.5">Today Win Rate</div>
                <div className={`text-sm font-bold font-mono tabular-nums ${(status.today_win_rate ?? 0) >= 50 ? 'text-green-400' : 'text-amber-400'}`}>
                  {(status.today_win_rate ?? 0).toFixed(1)}%
                </div>
              </div>
            </div>
            {/* Equity Curve */}
            {status.equity_curve && status.equity_curve.length >= 2 && (
              <EquityCurveChart data={status.equity_curve} height={160} />
            )}
          </div>
        </div>
      )}

      {/* Positions */}
      <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
        <div className="p-3 border-b border-surface-border flex items-center gap-2">
          <button onClick={() => setPositionTab('open')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${positionTab === 'open' ? 'bg-primary/15 text-primary' : 'text-text-muted hover:text-text'}`}>
            오픈 <span className="ml-1 opacity-60">{openPositions.length}</span>
          </button>
          <button onClick={() => setPositionTab('closed')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${positionTab === 'closed' ? 'bg-surface-hover text-text' : 'text-text-muted hover:text-text'}`}>
            청산완료 <span className="ml-1 opacity-60">{closedPositions.length}</span>
          </button>
          {positionTab === 'open' && openPositions.length > 0 && (
            <button onClick={() => { setShowTestExit(true); setTestExitPosId(openPositions[0]?.id ?? null) }}
              className="ml-auto flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-warning/15 text-warning hover:bg-warning/25 transition-colors">
              <LogOut size={10} /> 테스트 청산
            </button>
          )}
        </div>
        {positionTab === 'open' ? (
          openPositions.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-muted">오픈 포지션이 없습니다</div>
          ) : (
          <>
            {/* Table - hidden on small screens */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                    <tr className="border-b border-surface-border text-text-muted">
                      <th className="text-left px-3 py-2 font-medium">종목명</th>
                      <th className="text-left px-2 py-2 font-medium">전략</th>
                      <th className="text-right px-2 py-2 font-medium">진입가</th>
                      <th className="text-right px-2 py-2 font-medium">현재가</th>
                      <th className="text-right px-2 py-2 font-medium">최고가</th>
                      <th className="text-right px-3 py-2 font-medium">손익</th>
                      <th className="text-right px-2 py-2 font-medium">평가액</th>
                      <th className="text-right px-2 py-2 font-medium">비중</th>
                      <th className="text-right px-3 py-2 font-medium">보유일</th>
                      <th className="text-center px-2 py-2 font-medium">BUY</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {openPositions.map(p => {
                    const daysHeld = Math.max(0, Math.floor((Date.now() - new Date(p.entry_date).getTime()) / 86400000))
                    const absPnlPct = Math.abs(p.pnl_pct)
                    const barPct = Math.min(absPnlPct / 30 * 100, 100)
                    const posValue = p.current_price * p.quantity
                    const initialCapital = status?.initial_capital ?? 10000000
                    const allocationPct = (posValue / initialCapital) * 100
                    const maxPosAlloc = riskCheck?.max_position_allocation ?? 10
                    const buyBlocked = allocationPct > maxPosAlloc || (riskCheck?.blocked ?? false)
                    const isHighestConcentration = riskCheck?.highest_concentration_ticker === p.ticker
                    return (
                      <tr key={p.id} className="hover:bg-surface-hover/50 transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-text">{formatStockDisplay(p.name, p.ticker)}</span>
                            {isHighestConcentration && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium">TOP</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="text-[10px] text-text-muted bg-surface-border/30 px-1.5 py-0.5 rounded">S{p.strategy_id}</span>
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono text-text-muted text-[10px]">₩{p.entry_price.toLocaleString()}</td>
                        <td className="px-2 py-2.5 text-right font-mono text-text text-[11px]">₩{p.current_price.toLocaleString()}</td>
                        <td className="px-2 py-2.5 text-right font-mono text-[10px]">
                          <span className="text-amber-400">₩{(p.highest_price ?? p.current_price).toLocaleString()}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="w-16 h-1.5 rounded-full bg-surface-border overflow-hidden shrink-0">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  p.pnl_pct >= 0 ? 'bg-green-400' : 'bg-red-400'
                                }`}
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                            <div className={`text-[11px] font-bold font-mono tabular-nums ${p.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {p.pnl_pct >= 0 ? '+' : ''}{p.pnl_pct.toFixed(1)}%
                            </div>
                          </div>
                          <div className={`text-[9px] font-mono tabular-nums ${p.pnl_amt >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                            {p.pnl_amt >= 0 ? '+' : ''}₩{Math.abs(p.pnl_amt).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono text-text text-[10px]">₩{posValue.toLocaleString()}</td>
                        <td className="px-2 py-2.5 text-right">
                          <div className={`text-[11px] font-mono tabular-nums ${buyBlocked ? 'text-red-400' : 'text-green-400'}`}>
                            {allocationPct.toFixed(1)}%
                          </div>
                          <div className="text-[9px] text-text-muted">/ {maxPosAlloc.toFixed(0)}%</div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-text-muted text-[10px]">{daysHeld}d</td>
                        <td className="px-2 py-2.5 text-center">
                          {buyBlocked ? (
                            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-medium">
                              <Lock size={8} /> BLOCKED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium">
                              ALLOWED
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Card list - shown on small screens */}
            <div className="sm:hidden divide-y divide-surface-border">
              {openPositions.map(p => {
                const daysHeld = Math.max(0, Math.floor((Date.now() - new Date(p.entry_date).getTime()) / 86400000))
                const posValue = p.current_price * p.quantity
                return (
                  <div key={p.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-text">{formatStockDisplay(p.name, p.ticker)}</span>
                        <span className="text-[10px] text-text-muted bg-surface-border/30 px-1.5 py-0.5 rounded">S{p.strategy_id}</span>
                      </div>
                      <div className={`text-sm font-bold font-mono tabular-nums ${p.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {p.pnl_pct >= 0 ? '+' : ''}{p.pnl_pct.toFixed(1)}%
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px] text-text-muted">
                      <div>
                        <span className="block">진입가</span>
                        <span className="font-mono text-text">₩{p.entry_price.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="block">현재가</span>
                        <span className="font-mono text-text">₩{p.current_price.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="block">평가액</span>
                        <span className="font-mono text-text">₩{posValue.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[10px]">
                      <span className="text-text-muted">
                        수량: {p.quantity} &middot; {daysHeld}일
                      </span>
                      <span className={`font-mono tabular-nums ${p.pnl_amt >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                        {p.pnl_amt >= 0 ? '+' : ''}₩{Math.abs(p.pnl_amt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Summary row */}
            {(() => {
              const totalInvested = openPositions.reduce((s, p) => s + p.entry_price * p.quantity, 0)
              const totalValue = openPositions.reduce((s, p) => s + p.current_price * p.quantity, 0)
              const totalPnl = openPositions.reduce((s, p) => s + p.pnl_amt, 0)
              const avgReturn = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0
              return (
                <div className="border-t border-surface-border px-3 py-2 flex items-center gap-3 text-[10px] text-text-muted flex-wrap">
                  <span>총 투자: <span className="font-mono text-text">₩{totalInvested.toLocaleString()}</span></span>
                  <span>포지션 평가액: <span className="font-mono text-text">₩{totalValue.toLocaleString()}</span></span>
                  <span className={avgReturn >= 0 ? 'text-green-400/70' : 'text-red-400/70'}>
                    평균 수익률: <span className="font-mono">{avgReturn >= 0 ? '+' : ''}{avgReturn.toFixed(2)}%</span>
                  </span>
                </div>
              )
            })()}
          </>
          )
        ) : (
          closedPositions.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-muted">청산된 포지션이 없습니다</div>
          ) : (
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-surface-border text-text-muted">
                    <th className="text-left px-3 py-2 font-medium">종목명</th>
                    <th className="text-left px-2 py-2 font-medium">전략</th>
                    <th className="text-right px-2 py-2 font-medium">진입일</th>
                    <th className="text-right px-2 py-2 font-medium">진입가</th>
                    <th className="text-right px-2 py-2 font-medium">청산일</th>
                    <th className="text-right px-2 py-2 font-medium">청산가</th>
                    <th className="text-right px-2 py-2 font-medium">최고가</th>
                    <th className="text-right px-3 py-2 font-medium">손익</th>
                    <th className="text-right px-2 py-2 font-medium">손익금</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {closedPositions.map(p => {
                    const entryStr = p.entry_date?.slice(0, 10) ?? '-'
                    const exitStr = p.exit_date?.slice(0, 10) ?? '-'
                    return (
                      <tr key={p.id} className="hover:bg-surface-hover/50 transition-colors">
                        <td className="px-3 py-2.5">
                          <span className="text-xs font-medium text-text">{formatStockDisplay(p.name, p.ticker)}</span>
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="text-[10px] text-text-muted bg-surface-border/30 px-1.5 py-0.5 rounded">S{p.strategy_id}</span>
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono text-text-muted text-[10px]">{entryStr}</td>
                        <td className="px-2 py-2.5 text-right font-mono text-text-muted text-[10px]">₩{p.entry_price.toLocaleString()}</td>
                        <td className="px-2 py-2.5 text-right font-mono text-text-muted text-[10px]">{exitStr}</td>
                        <td className="px-2 py-2.5 text-right font-mono text-text text-[11px]">
                          {p.exit_price ? `₩${p.exit_price.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono text-amber-400 text-[10px]">
                          {p.highest_price ? `₩${p.highest_price.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`text-[11px] font-bold font-mono tabular-nums ${p.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {p.pnl_pct >= 0 ? '+' : ''}{p.pnl_pct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <span className={`text-[10px] font-mono tabular-nums ${p.pnl_amt >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                            {p.pnl_amt >= 0 ? '+' : ''}₩{Math.abs(p.pnl_amt).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Recent Trades */}
      <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
        <div className="p-3 border-b border-surface-border">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">최근 거래</h3>
        </div>
        {trades.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">거래 내역이 없습니다</div>
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
                {t.pnl_amt != null && t.pnl_amt !== 0 && (
                  <span className={`font-mono tabular-nums text-[10px] ${t.pnl_amt >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                    {t.pnl_amt >= 0 ? '+' : ''}₩{Math.abs(t.pnl_amt).toLocaleString()}
                  </span>
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
          title="청산 조건 테스트"
          message={`포지션 #${testExitPosId} 청산 시뮬레이션`}
          confirmLabel="테스트 실행"
          loading={testExitLoading}
          onConfirm={runTestExit}
          onCancel={() => setShowTestExit(false)}
        />
      )}

      {/* Reset Confirm */}
      <ConfirmDialog
        open={showResetConfirm}
        title="세션 초기화"
        message={`세션 초기화: "${currentSession?.name || `#${currentSessionId}`}" 모든 포지션, 거래, 신호가 삭제됩니다.`}
        confirmLabel="초기화"
        variant="danger"
        loading={resetLoading}
        onConfirm={handleResetSession}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Stop Confirm */}
      <ConfirmDialog
        open={showStopConfirm}
        title="세션 중지"
        message={`세션 종료: "${currentSession?.name || `#${currentSessionId}`}" 오픈 포지션이 청산됩니다.`}
        confirmLabel="중지"
        variant="danger"
        loading={stopLoading}
        onConfirm={handleStopSession}
        onCancel={() => setShowStopConfirm(false)}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="세션 삭제"
        message={`세션 삭제: "${sessions.find(s => s.id === deleteTargetId)?.name || `#${deleteTargetId}`}" 모든 포지션, 거래, 기록이 영구 삭제됩니다.`}
        confirmLabel="삭제"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteSession}
        onCancel={() => { setShowDeleteConfirm(false); setDeleteTargetId(null); }}
      />

      {/* New Session Modal */}
      {showNewSession && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setShowNewSession(false)}>
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 max-w-lg w-full mx-3 shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                <Settings size={16} className="text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-text">새 모의투자 세션</h3>
              <button onClick={() => setShowNewSession(false)} className="ml-auto text-text-muted hover:text-text">
                <XCircle size={14} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Session Name */}
              <div>
                <label className="text-[11px] font-medium text-text-muted mb-1 block">세션 이름</label>
                <input type="text" value={newSession.name} onChange={e => setNewSession({...newSession, name: e.target.value})}
                  placeholder={`세션 #${sessions.length + 1}`}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-surface border border-surface-border text-text placeholder-text-muted focus:outline-none focus:border-primary/50" />
              </div>

              {/* Initial Capital */}
              <div>
                <label className="text-[11px] font-medium text-text-muted mb-1 block">초기 자본</label>
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
                  <span className="text-[10px] text-text-muted">직접 입력</span>
                  {newSession.custom_capital && (
                    <input type="number" value={newSession.custom_capital_value}
                      onChange={e => setNewSession({...newSession, custom_capital_value: e.target.value})}
                      placeholder="금액 입력"
                      className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-text placeholder-text-muted focus:outline-none focus:border-primary/50" />
                  )}
                </div>
              </div>

              {/* Position Size */}
              <div>
                <label className="text-[11px] font-medium text-text-muted mb-1 block">포지션 크기 (1회 최대)</label>
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
                  <span className="text-[10px] text-text-muted">직접 입력</span>
                  {newSession.custom_position_size && (
                    <input type="number" value={newSession.custom_position_size_value}
                      onChange={e => setNewSession({...newSession, custom_position_size_value: e.target.value})}
                      placeholder="금액 입력"
                      className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-text placeholder-text-muted focus:outline-none focus:border-primary/50" />
                  )}
                </div>
              </div>

              {/* Max Positions */}
              <div>
                <label className="text-[11px] font-medium text-text-muted mb-1 block">최대 포지션 수</label>
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
                  자동 사이클 (장중 1시간마다 자동 실행)
                </label>
              </div>

              {/* Commission, Slippage, Tax */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-text-muted mb-1 block">수수료 (%)</label>
                  <input type="number" value={newSession.commission_pct} step="0.01"
                    onChange={e => { const r = e.target.value; setNewSession({...newSession, commission_pct: r === '' ? ('' as any) : (parseFloat(r) || 0) })}}
                    className="w-full text-xs px-2 py-1.5 rounded-lg bg-surface border border-surface-border text-text focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-text-muted mb-1 block">슬리피지 (%)</label>
                  <input type="number" value={newSession.slippage_pct} step="0.01"
                    onChange={e => { const r = e.target.value; setNewSession({...newSession, slippage_pct: r === '' ? ('' as any) : (parseFloat(r) || 0) })}}
                    className="w-full text-xs px-2 py-1.5 rounded-lg bg-surface border border-surface-border text-text focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-text-muted mb-1 block">세금 (%)</label>
                  <input type="number" value={newSession.tax_pct} step="0.01"
                    onChange={e => { const r = e.target.value; setNewSession({...newSession, tax_pct: r === '' ? ('' as any) : (parseFloat(r) || 0) })}}
                    className="w-full text-xs px-2 py-1.5 rounded-lg bg-surface border border-surface-border text-text focus:outline-none focus:border-primary/50" />
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end pt-2 border-t border-surface-border">
                <button onClick={() => setShowNewSession(false)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-surface-border text-text-muted hover:text-text transition-colors">
                  취소
                </button>
                <button onClick={handleCreateSession} disabled={newSessionLoading}
                  className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                  <Save size={12} /> {newSessionLoading ? '생성 중...' : '세션 생성'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EquityCurveChart({ data, height = 160 }: { data: { time: string; value: number }[]; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null)

  useEffect(() => {
    if (!containerRef.current || data.length < 2) return

    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9CA3AF',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: '#1F2937' },
        horzLines: { color: '#1F2937' },
      },
      rightPriceScale: {
        borderColor: '#1F2937',
        scaleMargins: { top: 0.05, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#1F2937',
        visible: true,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: '#6B7280', width: 1, style: 2, labelBackgroundColor: '#1F2937' },
        horzLine: { color: '#6B7280', width: 1, style: 2, labelBackgroundColor: '#1F2937' },
      },
      handleScroll: false,
      handleScale: false,
      autoSize: true,
    })

    const series = chart.addSeries(LineSeries, {
      color: '#22C55E',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      priceFormat: {
        type: 'custom',
        formatter: (v: number) => '₩' + Math.round(v).toLocaleString(),
      },
      lastValueVisible: true,
      priceLineVisible: false,
    })

    // Convert HH:MM time strings to UTCTimestamp (seconds since epoch, today's date)
    const today = new Date()
    const chartData = data.map(d => {
      const [h, m] = d.time.split(':').map(Number)
      const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m, 0)
      return { time: Math.floor(dt.getTime() / 1000) as any, value: d.value }
    })
    series.setData(chartData)

    chart.timeScale().fitContent()
    chartRef.current = chart

    return () => {
      chart.remove()
      chartRef.current = null
    }
  }, [data, height])

  return <div ref={containerRef} className="w-full" style={{ height }} />
}
