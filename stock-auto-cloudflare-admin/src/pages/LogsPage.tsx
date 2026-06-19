import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { AlertCircle, Info, AlertTriangle, Bug, RefreshCw, Filter } from 'lucide-react'
import { formatKST } from '../utils/kst'

interface LogEntry {
  id: number
  log_type: string
  source: string
  message: string
  details: string | null
  created_at: string
  created_at_kst?: string
}

const logTypeMeta: Record<string, { icon: any; color: string }> = {
  info: { icon: Info, color: 'text-blue-400' },
  warning: { icon: AlertTriangle, color: 'text-amber-400' },
  error: { icon: AlertCircle, color: 'text-red-400' },
  debug: { icon: Bug, color: 'text-text-muted' },
}

const typeFilters = ['all', 'info', 'warning', 'error', 'debug']

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [typeFilter])

  async function load() {
    try {
      const path = typeFilter === 'all' ? '/api/logs' : `/api/logs?log_type=${typeFilter}`
      const data = await api.get<LogEntry[]>(path)
      setLogs(data || [])
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">System Logs</h2>
        <button onClick={load} className="p-2 text-text-muted hover:text-text transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {typeFilters.map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded-full whitespace-nowrap transition-colors ${
              typeFilter === t ? 'bg-primary text-white' : 'bg-surface-card text-text-muted border border-surface-border'
            }`}>
            {t === 'all' && <Filter size={10} />}
            {t === 'error' && <AlertCircle size={10} />}
            {t === 'warning' && <AlertTriangle size={10} />}
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">No logs found</div>
        ) : (
          <div className="divide-y divide-surface-border max-h-[65vh] overflow-y-auto">
            {logs.map((log) => {
              const meta = logTypeMeta[log.log_type] || { icon: Info, color: 'text-text-muted' }
              const Icon = meta.icon
              const isError = log.log_type === 'error'
              return (
                <div key={log.id} className={`px-4 py-2.5 ${isError ? 'bg-red-500/5' : ''}`}>
                  <div className="flex items-start gap-2">
                    <Icon size={14} className={`mt-0.5 shrink-0 ${meta.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-medium ${meta.color}`}>{log.log_type.toUpperCase()}</span>
                        {log.source && <span className="text-[10px] text-text-muted">{log.source}</span>}
                        {log.created_at && (
                          <span className="text-[9px] text-text-muted ml-auto shrink-0">
                            {log.created_at_kst || formatKST(log.created_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text mt-0.5 break-words">{log.message}</p>
                      {log.details && typeof log.details === 'string' && log.details !== 'null' && (
                        <pre className="text-[9px] text-text-muted mt-1 bg-surface rounded p-1.5 overflow-x-auto max-h-20">
                          {log.details}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
