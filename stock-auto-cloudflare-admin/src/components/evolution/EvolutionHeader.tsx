import { Zap, RotateCw, Play, RefreshCw } from 'lucide-react'
import type { EvolutionStatus } from '../../utils/api'

interface Props {
  status: EvolutionStatus | null
  onRun: () => void
  onRefresh: () => void
}

export function EvolutionHeader({ status, onRun, onRefresh }: Props) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Zap size={20} className="text-primary" />
        <h2 className="text-lg font-bold text-text">AI Evolution</h2>
      </div>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
          status?.is_running
            ? 'bg-amber-500/10 text-amber-500'
            : status?.status === 'error'
            ? 'bg-red-500/10 text-red-500'
            : status?.status === 'stopped'
            ? 'bg-slate-500/10 text-slate-400'
            : 'bg-green-500/10 text-green-500'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            status?.is_running ? 'bg-amber-500 animate-pulse' :
            status?.status === 'error' ? 'bg-red-500' :
            status?.status === 'stopped' ? 'bg-slate-400' :
            'bg-green-500'
          }`} />
          {status?.is_running ? 'Running' : status?.status === 'error' ? 'Error' : status?.status === 'stopped' ? 'Stopped' : 'Idle'}
        </span>
        <button
          onClick={onRun}
          disabled={status?.is_running}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg disabled:opacity-50"
        >
          <Play size={12} />
          Run
        </button>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1 px-3 py-1.5 bg-surface-card text-text-muted text-xs font-medium rounded-lg border border-surface-border"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>
    </div>
  )
}
