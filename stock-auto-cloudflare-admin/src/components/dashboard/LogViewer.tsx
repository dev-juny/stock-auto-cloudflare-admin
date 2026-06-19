import { useLogs } from '../../hooks/useLogs'
import { Card } from '../common/Card'
import { Badge } from '../common/Badge'
import { CardSkeleton } from '../common/Skeleton'
import { formatTime } from '../../utils/format'

const levelVariant = (level: string) => {
  switch (level) {
    case 'ERROR': return 'danger' as const
    case 'WARN': return 'warning' as const
    case 'INFO': return 'info' as const
    default: return 'muted' as const
  }
}

export function LogViewer() {
  const { logs, loading } = useLogs()

  if (loading) return <CardSkeleton />

  const recent = logs.slice(0, 5)

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary">시스템 로그</h2>
        {logs.length > 5 && (
          <span className="text-[11px] text-text-muted">{logs.length}건</span>
        )}
      </div>
      {recent.length === 0 ? (
        <p className="text-xs text-text-muted">로그가 없습니다</p>
      ) : (
        <div className="space-y-2">
          {recent.map((l) => (
            <div key={l.LOG_ID} className="flex items-start gap-2">
              <Badge variant={levelVariant(l.LOG_LEVEL)}>{l.LOG_LEVEL}</Badge>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-text-primary leading-snug">
                  {l.MESSAGE}
                </div>
                <div className="text-[10px] text-text-muted mt-0.5 font-mono tabular-nums">
                  {formatTime(l.CREATED_AT)} · {l.SOURCE}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {logs.length > 5 && (
        <button className="w-full text-center text-xs text-text-muted hover:text-text-primary mt-2 min-h-[36px] transition-colors">
          모든 로그 보기
        </button>
      )}
    </Card>
  )
}
