import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { Play, Pause, RotateCw, RefreshCw, Timer, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { formatKST } from '../../utils/kst'

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
}

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<JobInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<JobInfo | null>(null)

  useEffect(() => {
    load()
    const iv = setInterval(load, 15000)
    return () => clearInterval(iv)
  }, [])

  async function load() {
    try {
      const d = await api.get<{ jobs: JobInfo[] }>('/api/scheduler/jobs')
      setJobs(d.jobs || [])
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">Scheduler</h2>
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

      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-surface-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[70vh] overflow-y-auto">
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
                        {h.message && <p className="text-text-muted mt-0.5 truncate">{h.message}</p>}
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
