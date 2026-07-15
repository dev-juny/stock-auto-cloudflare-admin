import { useState } from 'react'
import { useLogs } from '../../hooks/useLogs'
import { Card } from '../common/Card'
import { CardSkeleton } from '../common/Skeleton'
import { formatTime } from '../../utils/format'
import { AlertCircle, Info, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'

const levelConfig: Record<string, { icon: typeof AlertCircle; color: string; bg: string }> = {
  ERROR: { icon: AlertCircle, color: 'text-danger', bg: 'bg-danger/10' },
  WARN: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  INFO: { icon: Info, color: 'text-primary', bg: 'bg-primary/10' },
}

export function LogViewer() {
  const { logs, loading } = useLogs()
  const [showAll, setShowAll] = useState(false)

  if (loading) return <CardSkeleton />

  const display = showAll ? logs.slice(0, 50) : logs.slice(0, 5)
  const hasMore = logs.length > 5

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary">시스템 로그</h2>
        {logs.length > 0 && (
          <span className="text-[11px] text-text-muted">{logs.length}건</span>
        )}
      </div>

      {display.length === 0 ? (
        <p className="text-xs text-text-muted py-4 text-center">로그가 없습니다</p>
      ) : (
        <div className="space-y-1">
          {display.map((l) => {
            const level = l.log_type || 'INFO'
            const cfg = levelConfig[level] || levelConfig.INFO
            const Icon = cfg.icon
            return (
              <div key={l.id} className="flex items-start gap-2.5 py-2 border-b border-surface-border last:border-0">
                <div className={`mt-0.5 ${cfg.color}`}>
                  <Icon size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
                      {level}
                    </span>
                    <span className="text-[10px] text-text-muted font-mono">{l.source}</span>
                    <span className="text-[10px] text-text-muted/60 font-mono tabular-nums ml-auto">
                      {formatTime(l.created_at)}
                    </span>
                  </div>
                  <div className="text-xs text-text-primary leading-snug">{l.message}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full flex items-center justify-center gap-1 text-xs text-text-muted hover:text-text-primary mt-2 min-h-[36px] transition-colors"
        >
          {showAll ? (
            <>접기 <ChevronUp size={14} /></>
          ) : (
            <>최근 {logs.length}건 모두 보기 <ChevronDown size={14} /></>
          )}
        </button>
      )}
    </Card>
  )
}
