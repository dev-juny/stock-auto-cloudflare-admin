import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { Tooltip } from '../../components/common/Tooltip'
import { findGlossary } from '../../utils/glossary'
import { Play, Pause, RotateCw, RefreshCw, Timer, CheckCircle, XCircle, Zap, Database } from 'lucide-react'
import { formatKST } from '../../utils/kst'
import { EvolutionStatus } from '../../utils/api'

interface JobInfo {
  job_id: string
  job_name: string
  cron_expression: string
  status: string
  description?: string
  next_run_time?: string | null
  next_run_time_kst?: string | null
  created_at?: string
  history?: JobHistory[]
  latest_trade_date?: string
}

interface JobHistory {
  id: number
  start_time: string
  start_time_kst?: string
  end_time: string
  end_time_kst?: string
  status: string
  execution_time_ms: number
  message: string
  ticker_count?: number
  inserted_rows?: number
  updated_rows?: number
  error_message?: string
}

interface EvolutionSchedulerInfo {
  status: EvolutionStatus | null
  config: { min_generation_interval_hours: number } | null
  recent_generations: Array<{
    generation: number
    population_size: number
    avg_fitness: number
    avg_return: number
    avg_winrate: number
    avg_mdd: number
    created_at_kst: string
  }>
}

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<JobInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<JobInfo | null>(null)
  const [evoInfo, setEvoInfo] = useState<EvolutionSchedulerInfo | null>(null)

  useEffect(() => {
    load()
    const iv = setInterval(load, 15000)
    return () => clearInterval(iv)
  }, [])

  async function load() {
    try {
      const [d, evo, marketDate] = await Promise.all([
        api.get<{ jobs: JobInfo[] }>('/api/scheduler/jobs'),
        api.get<EvolutionSchedulerInfo>('/api/scheduler/evolution'),
        api.get<{ latest_trade_date: string }>('/api/scheduler/market/latest-trade-date').catch(() => null),
      ])
      const jobs = d.jobs || []
      if (marketDate?.latest_trade_date) {
        const marketJob = jobs.find(j => j.job_id === 'market_data_sync')
        if (marketJob) marketJob.latest_trade_date = marketDate.latest_trade_date
      }
      setJobs(jobs)
      setEvoInfo(evo)
    } catch {} finally {
      setLoading(false)
    }
  }

  async function loadDetail(jobId: string) {
    try {
      const d = await api.get<JobInfo>(`/api/scheduler/jobs/${jobId}`)
      setSelectedJob(d)
    } catch {}
  }

  async function runJob(jobId: string) {
    try {
      await api.post(`/api/scheduler/jobs/${jobId}/run`)
      setTimeout(load, 1000)
    } catch {}
  }

  async function pauseJob(jobId: string) {
    try {
      await api.post(`/api/scheduler/jobs/${jobId}/pause`)
      load()
    } catch {}
  }

  async function resumeJob(jobId: string) {
    try {
      await api.post(`/api/scheduler/jobs/${jobId}/resume`)
      load()
    } catch {}
  }

  const statusIcon = (s: string) => {
    switch (s) {
      case 'RUNNING': return <CheckCircle size={14} className="text-green-400" />
      case 'PAUSED': return <Pause size={14} className="text-amber-400" />
      case 'FAILED': return <XCircle size={14} className="text-red-400" />
      default: return <Timer size={14} className="text-text-muted" />
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-xs text-text-muted">Loading scheduler...</div>
  }

  return (
    <div className="space-y-4 pb-12">
      <div className="flex justify-end">
        <button onClick={load} className="p-2 text-text-muted hover:text-text transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-surface-card rounded-2xl border border-surface-border p-6 text-center text-xs text-text-muted">
          No scheduler jobs found
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <div key={job.job_id}
              className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {statusIcon(job.status)}
                      <span className="text-sm font-medium text-text truncate">{job.job_name}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        job.status === 'RUNNING' ? 'bg-green-500/10 text-green-400' :
                        job.status === 'PAUSED' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-surface-border text-text-muted'
                      }`}>{job.status}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-text-muted">
                      <span>ID: {job.job_id}</span>
                      {job.cron_expression && <span>Cron: {job.cron_expression}</span>}
                      {job.next_run_time && <span>Next: {job.next_run_time_kst || formatKST(job.next_run_time)}</span>}
                      {job.job_id === 'market_data_sync' && (
                        <span className="flex items-center gap-1">
                          <Database size={10} />
                          Latest: <span className="text-text font-medium">{job.latest_trade_date || '?'}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => runJob(job.job_id)}
                      className="p-1.5 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                      title="Run now">
                      <Play size={14} />
                    </button>
                    {job.status === 'RUNNING' ? (
                      <button onClick={() => pauseJob(job.job_id)}
                        className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                        title="Pause">
                        <Pause size={14} />
                      </button>
                    ) : (
                      <button onClick={() => resumeJob(job.job_id)}
                        className="p-1.5 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                        title="Resume">
                        <Play size={14} />
                      </button>
                    )}
                    <button onClick={() => loadDetail(job.job_id)}
                      className="p-1.5 text-text-muted hover:text-text rounded-lg transition-colors"
                      title="View history">
                      <RotateCw size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {evoInfo && evoInfo.status && (
        <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
          <div className="p-3 border-b border-surface-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-400" />
              <span className="text-sm font-medium text-text">Evolution Scheduler</span>
            </div>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              evoInfo.status.status === 'running' ? 'bg-green-500/10 text-green-400' :
              evoInfo.status.status === 'idle' ? 'bg-blue-500/10 text-blue-400' :
              evoInfo.status.status?.startsWith('error') ? 'bg-red-500/10 text-red-400' :
              'bg-surface-border text-text-muted'
            }`}>{evoInfo.status.status}</span>
          </div>
          <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <Tooltip content={findGlossary('generation')?.description ?? 'Generation'}>
                <span className="text-text-muted">Generation</span>
              </Tooltip>
              <p className="text-text font-bold text-sm">{evoInfo.status.current_generation}</p>
            </div>
            <div>
              <span className="text-text-muted">Interval</span>
              <p className="text-text font-medium">{evoInfo.config ? `${(evoInfo.config.min_generation_interval_hours * 60).toFixed(0)}m` : '-'}</p>
            </div>
            <div>
              <span className="text-text-muted">Last Run (KST)</span>
              <p className="text-text font-medium">{evoInfo.status.last_run_at_kst ? formatKST(evoInfo.status.last_run_at_kst) : '-'}</p>
            </div>
            <div>
              <span className="text-text-muted">Next Run (KST)</span>
              <p className="text-text font-medium">{evoInfo.status.next_scheduled_run_kst ? formatKST(evoInfo.status.next_scheduled_run_kst) : '-'}</p>
            </div>
            <div>
              <span className="text-text-muted">Active Strategies</span>
              <p className="text-text font-medium">{evoInfo.status.active_strategies}</p>
            </div>
            <div>
              <span className="text-text-muted">Evolution Enabled</span>
              <p className="text-text font-medium">{evoInfo.config?.min_generation_interval_hours ? 'Yes' : 'No'}</p>
            </div>
          </div>

          {evoInfo.recent_generations && evoInfo.recent_generations.length > 0 && (
            <div className="border-t border-surface-border">
              <div className="px-3 py-2">
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Recent Generations</span>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-text-muted border-t border-surface-border">
                        <th className="text-left px-3 py-1.5 font-medium whitespace-nowrap">Gen</th>
                        <th className="text-right px-2 py-1.5 font-medium whitespace-nowrap">
                          <Tooltip content={findGlossary('fitness')?.description ?? 'Fitness'}>
                            <span>Fitness</span>
                          </Tooltip>
                        </th>
                        <th className="text-right px-2 py-1.5 font-medium whitespace-nowrap">
                          <Tooltip content={findGlossary('return')?.description ?? 'Return'}>
                            <span>Return</span>
                          </Tooltip>
                        </th>
                        <th className="text-right px-2 py-1.5 font-medium whitespace-nowrap">
                          <Tooltip content={findGlossary('winRate')?.description ?? 'Win Rate'}>
                            <span>Win Rate</span>
                          </Tooltip>
                        </th>
                        <th className="text-right px-2 py-1.5 font-medium whitespace-nowrap">
                          <Tooltip content={findGlossary('mdd')?.description ?? 'MDD'}>
                            <span>MDD</span>
                          </Tooltip>
                        </th>
                        <th className="text-right px-2 py-1.5 font-medium whitespace-nowrap">Time (KST)</th>
                      </tr>
                    </thead>
                  <tbody className="divide-y divide-surface-border">
                    {evoInfo.recent_generations.slice(0, 10).map(g => (
                      <tr key={g.generation} className="hover:bg-surface/50 transition-colors">
                        <td className="px-3 py-1.5 text-text font-medium">{g.generation}</td>
                        <td className="px-2 py-1.5 text-right text-amber-400">{g.avg_fitness.toFixed(2)}</td>
                        <td className={`px-2 py-1.5 text-right ${g.avg_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {g.avg_return >= 0 ? '+' : ''}{g.avg_return.toFixed(2)}%
                        </td>
                        <td className="px-2 py-1.5 text-right text-blue-400">{g.avg_winrate.toFixed(1)}%</td>
                        <td className="px-2 py-1.5 text-right text-red-400">{g.avg_mdd.toFixed(2)}%</td>
                        <td className="px-2 py-1.5 text-right text-text-muted whitespace-nowrap">
                          {g.created_at_kst ? g.created_at_kst.split(' ')[1]?.slice(0, 5) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-surface-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface-card border-b border-surface-border p-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">{selectedJob.job_name}</h3>
              <button onClick={() => setSelectedJob(null)} className="text-text-muted hover:text-text text-lg leading-none">&times;</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-text-muted">Job ID</span><p className="text-text font-mono">{selectedJob.job_id}</p></div>
                <div><span className="text-text-muted">Status</span><p className="text-text">{selectedJob.status}</p></div>
                <div><span className="text-text-muted">Cron</span><p className="text-text font-mono">{selectedJob.cron_expression || '-'}</p></div>
                <div><span className="text-text-muted">Next Run</span><p className="text-text">{selectedJob.next_run_time_kst || formatKST(selectedJob.next_run_time)}</p></div>
                {selectedJob.latest_trade_date && (
                  <div className="col-span-2"><span className="text-text-muted">Latest Data Date</span><p className="text-text font-medium">{selectedJob.latest_trade_date}</p></div>
                )}
              </div>

              {selectedJob.history && selectedJob.history.length > 0 && (
                <>
                  <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Execution History</h4>
                  <div className="divide-y divide-surface-border">
                    {selectedJob.history.slice(0, 20).map((h) => (
                      <div key={h.id} className="py-2 text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${h.status === 'SUCCESS' ? 'text-green-400' : h.status === 'FAIL' ? 'text-red-400' : 'text-text-muted'}`}>{h.status}</span>
                          <span className="text-text-muted">{h.execution_time_ms}ms</span>
                          <span className="text-text-muted ml-auto">{h.start_time_kst || formatKST(h.start_time)}</span>
                        </div>
                        {h.ticker_count != null && (
                          <div className="flex gap-3 mt-0.5 text-[10px] text-text-muted">
                            <span>Tickers: <span className="text-text">{h.ticker_count}</span></span>
                            <span>Inserted: <span className="text-green-400">{h.inserted_rows}</span></span>
                            <span>Updated: <span className="text-blue-400">{h.updated_rows}</span></span>
                          </div>
                        )}
                        {h.message && <p className="text-text-muted mt-0.5 truncate">{h.message}</p>}
                        {h.error_message && <p className="text-red-400 mt-0.5 truncate">{h.error_message}</p>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
