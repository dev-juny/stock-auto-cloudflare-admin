import { useState, useEffect, useCallback } from 'react'
import { api } from '../utils/api'
import { useAction } from '../hooks/useAction'
import { useToast } from '../components/common/Toast'
import { formatKST } from '../utils/kst'
import {
  Play, RotateCcw, Settings, ChevronDown, ChevronUp,
  Activity, CheckCircle, XCircle, Clock, AlertTriangle,
  Zap, BarChart3, TrendingUp, Shield, Award, Eye,
  RefreshCw, Save, ArrowRight, Timer, Layers,
} from 'lucide-react'

const STEP_LABELS: Record<string, string> = {
  evolution: '진화',
  ranking: '랭킹',
  auto_promotion: '자동승격',
  paper_trading: '모의투자',
  survivor_selection: '서바이버',
  auto_shadow_sessions: '섀도우 생성',
  shadow_trading: '섀도우 트레이딩',
  promote_production: '프로덕션 승격',
}

const STEP_ICONS: Record<string, typeof Zap> = {
  evolution: Zap,
  ranking: BarChart3,
  auto_promotion: TrendingUp,
  paper_trading: Play,
  survivor_selection: Shield,
  auto_shadow_sessions: Eye,
  shadow_trading: Activity,
  promote_production: Award,
}

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: 'text-success',
  SKIPPED: 'text-text-muted',
  FAILED: 'text-danger',
  RUNNING: 'text-warning',
  never: 'text-text-muted',
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'SUCCESS') return <CheckCircle size={14} className="text-success" />
  if (status === 'FAILED') return <XCircle size={14} className="text-danger" />
  if (status === 'RUNNING') return <RotateCcw size={14} className="text-warning animate-spin" />
  return <Clock size={14} className="text-text-muted" />
}

interface PipelineStatus {
  locked: boolean
  last_run_id: string
  last_status: string
  last_pipeline_run: string
  scheduler_running: boolean
  steps: Record<string, { status: string; started_at: string }>
  evolution: { current_generation: number; status: string; last_run: string } | null
  survival_counts: Record<string, number>
  portfolio_health: Record<string, any>
  config: Record<string, any>
}

interface PipelineLog {
  id: number
  started_at: string
  finished_at: string
  step: string
  status: string
  duration_ms: number
  message: string
  details: string
  pipeline_run_id: string
}

export default function PipelinePage() {
  const [status, setStatus] = useState<PipelineStatus | null>(null)
  const [logs, setLogs] = useState<PipelineLog[]>([])
  const [config, setConfig] = useState<Record<string, any>>({})
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [editingConfig, setEditingConfig] = useState<Record<string, any>>({})
  const [isEditing, setIsEditing] = useState(false)
  const { toast } = useToast()
  const { loading: actionLoading, execute } = useAction()

  const fetchStatus = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        api.get<PipelineStatus>('/api/pipeline/status'),
        api.get<PipelineLog[]>('/api/pipeline/logs?limit=30'),
      ])
      setStatus(s)
      setLogs(l)
      setConfig(s.config || {})
    } catch (e: any) {
      toast('error', `파이프라인 상태 로드 실패: ${e.message}`)
    } finally {
      setLoadingStatus(false)
    }
  }, [toast])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  useEffect(() => {
    const id = setInterval(fetchStatus, 30000)
    return () => clearInterval(id)
  }, [fetchStatus])

  const runPipeline = useCallback(async (startStep?: string) => {
    await execute(async () => {
      const body = startStep ? { start_step: startStep } : {}
      const res = await api.post<{ status: string; pipeline_run_id: string; steps: Record<string, any> }>(
        '/api/pipeline/run', body, { timeout: 180000 },
      )
      fetchStatus()
      return res
    }, '파이프라인 실행 완료')
  }, [execute, fetchStatus])

  const runStep = useCallback(async (stepName: string) => {
    await execute(async () => {
      const res = await api.post<{ status: string; message: string }>(
        `/api/pipeline/step/${stepName}`, {}, { timeout: 120000 },
      )
      fetchStatus()
      return res
    }, `${STEP_LABELS[stepName] || stepName} 단계 실행 완료`)
  }, [execute, fetchStatus])

  const saveConfig = useCallback(async () => {
    await execute(async () => {
      const res = await api.post<Record<string, any>>('/api/pipeline/config', editingConfig)
      setConfig(res)
      setIsEditing(false)
      return res
    }, '설정 저장 완료')
  }, [execute, editingConfig])

  const startEditConfig = () => {
    setEditingConfig({ ...config })
    setIsEditing(true)
  }

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!status) {
    return (
      <div className="text-center py-12 text-text-muted">
        파이프라인 상태를 불러올 수 없습니다.
      </div>
    )
  }

  const stageCount = Object.values(status.survival_counts || {}).reduce((a: number, b: number) => a + b, 0)
  const pipelineSteps = [
    'evolution', 'ranking', 'auto_promotion', 'paper_trading',
    'survivor_selection', 'auto_shadow_sessions', 'shadow_trading', 'promote_production',
  ]

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-primary" />
            <span className="text-sm font-bold text-text">파이프라인 상태</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge ${status.scheduler_running ? 'badge-success' : 'badge-ghost'}`}>
              <Timer size={10} />
              {status.scheduler_running ? '스케줄러 활성' : '스케줄러 중지'}
            </span>
            {status.locked && (
              <span className="badge badge-warning">
                <AlertTriangle size={10} /> 잠김
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-text-muted">최근 실행</div>
            <div className="text-sm font-mono text-text mt-0.5">
              {status.last_pipeline_run ? formatKST(status.last_pipeline_run) : '없음'}
            </div>
          </div>
          <div>
            <div className="text-xs text-text-muted">최근 상태</div>
            <div className={`text-sm font-bold mt-0.5 ${STATUS_COLORS[status.last_status] || 'text-text'}`}>
              {status.last_status}
            </div>
          </div>
          <div>
            <div className="text-xs text-text-muted">전략 수</div>
            <div className="text-sm font-bold text-text mt-0.5">{stageCount}</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Play size={16} className="text-primary" />
          <span className="text-sm font-bold text-text">실행</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => runPipeline()}
            disabled={actionLoading}
            className="btn btn-primary text-xs py-2"
          >
            <Play size={14} />
            전체 파이프라인
          </button>
          <button
            onClick={() => runPipeline('ranking')}
            disabled={actionLoading}
            className="btn btn-ghost text-xs py-2"
          >
            <ArrowRight size={14} />
            Ranking부터 실행
          </button>
        </div>
      </div>

      {/* Pipeline Steps */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-primary" />
            <span className="text-sm font-bold text-text">단계별 상태</span>
          </div>
        </div>
        <div className="space-y-1.5">
          {pipelineSteps.map((step, i) => {
            const stepData = status.steps[step]
            const Icon = STEP_ICONS[step] || Activity
            const s = stepData?.status || 'never'
            const isLast = i === pipelineSteps.length - 1
            return (
              <div key={step} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="text-[10px] text-text-muted w-4 text-right">{i + 1}</span>
                  <Icon size={13} className="shrink-0" />
                  <span className="text-xs text-text truncate">{STEP_LABELS[step] || step}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusIcon status={s} />
                  <span className={`text-[10px] font-mono ${STATUS_COLORS[s] || 'text-text-muted'}`}>
                    {s}
                  </span>
                  {stepData?.started_at && (
                    <span className="text-[9px] text-text-muted hidden sm:inline">
                      {formatKST(stepData.started_at)}
                    </span>
                  )}
                  <button
                    onClick={() => runStep(step)}
                    disabled={actionLoading}
                    className="text-[10px] text-primary hover:text-primary/80 px-1"
                    title="이 단계 실행"
                  >
                    ▶
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Survival Counts */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-primary" />
            <span className="text-sm font-bold text-text">전략 Lifecycle 분포</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { key: 'created', label: '생성됨', color: 'text-text-muted' },
            { key: 'backtesting', label: '백테스트', color: 'text-warning' },
            { key: 'paper_trading', label: '모의투자', color: 'text-primary' },
            { key: 'survivor', label: '서바이버', color: 'text-success' },
            { key: 'production_candidate', label: '프로덕션 후보', color: 'text-warning' },
            { key: 'shadow_trading', label: '섀도우', color: 'text-primary' },
            { key: 'production', label: '프로덕션', color: 'text-success' },
            { key: 'approved', label: '승인됨', color: 'text-success' },
            { key: 'failed', label: '실패', color: 'text-danger' },
            { key: 'retired', label: '폐기', color: 'text-text-muted' },
          ].map(({ key, label, color }) => (
            <div key={key} className="bg-surface rounded-lg p-2 text-center">
              <div className={`text-lg font-bold font-mono ${color}`}>
                {status.survival_counts?.[key] ?? 0}
              </div>
              <div className="text-[10px] text-text-muted">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Portfolio Health */}
      {status.portfolio_health && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-primary" />
            <span className="text-sm font-bold text-text">포트폴리오 건강도</span>
            {status.portfolio_health.grade && (
              <span className="badge badge-primary">{status.portfolio_health.grade}</span>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
            {[
              { label: '총수익', value: status.portfolio_health.total_return, fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
              { label: 'CAGR', value: status.portfolio_health.cagr, fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
              { label: 'MDD', value: status.portfolio_health.max_drawdown, fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
              { label: 'Sharpe', value: status.portfolio_health.sharpe_ratio, fmt: (v: number) => v?.toFixed(2) },
              { label: 'PF', value: status.portfolio_health.profit_factor, fmt: (v: number) => v?.toFixed(2) },
              { label: '승률', value: status.portfolio_health.win_rate, fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
            ].map(({ label, value, fmt }) => (
              <div key={label}>
                <div className="text-xs text-text-muted">{label}</div>
                <div className="text-sm font-mono font-bold text-text">
                  {value != null ? fmt(value) : 'N/A'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Config */}
      <div className="card p-4">
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-primary" />
            <span className="text-sm font-bold text-text">설정</span>
          </div>
          {showConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showConfig && (
          <div className="mt-3 space-y-2">
            {isEditing ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(editingConfig).map(([key, value]) => (
                    <div key={key}>
                      <label className="text-[10px] text-text-muted">{key}</label>
                      <input
                        type={typeof value === 'number' ? 'number' : 'text'}
                        step={typeof value === 'number' && value < 1 ? '0.1' : '1'}
                        value={String(editingConfig[key] ?? '')}
                        onChange={e => setEditingConfig(prev => ({
                          ...prev,
                          [key]: typeof value === 'number' ? parseFloat(e.target.value) || 0 : e.target.value,
                        }))}
                        className="w-full bg-surface border border-surface-border rounded px-2 py-1 text-xs text-text mt-0.5"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={saveConfig} disabled={actionLoading} className="btn btn-primary text-xs py-1.5">
                    <Save size={12} /> 저장
                  </button>
                  <button onClick={() => setIsEditing(false)} className="btn btn-ghost text-xs py-1.5">
                    취소
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(config).map(([key, value]) => (
                    <div key={key} className="bg-surface rounded p-2">
                      <div className="text-[10px] text-text-muted">{key}</div>
                      <div className="text-xs font-mono font-bold text-text">
                        {String(value)}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={startEditConfig} className="btn btn-ghost text-xs py-1.5 mt-2">
                  <Settings size={12} /> 편집
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Logs */}
      <div className="card p-4">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-primary" />
            <span className="text-sm font-bold text-text">실행 로그</span>
            <span className="text-[10px] text-text-muted">({logs.length}건)</span>
          </div>
          {showLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showLogs && (
          <div className="mt-3 space-y-1 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-xs text-text-muted text-center py-4">실행 기록이 없습니다.</div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="flex items-center gap-2 py-1.5 border-b border-surface-border last:border-0">
                  <StatusIcon status={log.status} />
                  <span className="text-[10px] text-text-muted w-16 shrink-0">
                    {formatKST(log.started_at)}
                  </span>
                  <span className="text-xs text-text truncate flex-1">
                    {STEP_LABELS[log.step] || log.step}
                  </span>
                  <span className={`text-[10px] font-mono ${STATUS_COLORS[log.status] || 'text-text-muted'}`}>
                    {log.status}
                  </span>
                  {log.duration_ms > 0 && (
                    <span className="text-[10px] text-text-muted">
                      {((log.duration_ms ?? 0) / 1000).toFixed(1)}s
                    </span>
                  )}
                  {log.message && (
                    <span className="text-[10px] text-text-muted max-w-[200px] truncate hidden sm:inline" title={log.message}>
                      {log.message}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Refresh */}
      <button
        onClick={fetchStatus}
        className="btn btn-ghost text-xs w-full py-2"
      >
        <RefreshCw size={14} /> 새로고침
      </button>
    </div>
  )
}
