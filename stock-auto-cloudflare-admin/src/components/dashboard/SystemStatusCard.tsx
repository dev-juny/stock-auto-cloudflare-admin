import { Clock, Database, Server, RefreshCw } from 'lucide-react'
import { Card } from '../common/Card'
import { Badge } from '../common/Badge'
import { SystemStatus } from '../../hooks/useHealth'
import { CardSkeleton } from '../common/Skeleton'

interface SystemStatusCardProps {
  status: SystemStatus
  loading: boolean
  onRefresh: () => void
}

export function SystemStatusCard({ status, loading, onRefresh }: SystemStatusCardProps) {
  if (loading) return <CardSkeleton />

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary">시스템 상태</h2>
        <button onClick={onRefresh} className="btn-ghost min-h-[36px] min-w-[36px] p-2">
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server size={14} className="text-text-muted" />
            <span className="text-xs text-text-muted">백엔드</span>
          </div>
          <Badge
            variant={status.status === 'online' ? 'success' : status.status === 'warning' ? 'warning' : 'danger'}
          >
            {status.status === 'online' ? 'ONLINE' : status.status === 'warning' ? 'WARNING' : 'OFFLINE'}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-text-muted" />
            <span className="text-xs text-text-muted">가동 시간</span>
          </div>
          <span className="text-xs font-mono tabular-nums text-text-primary">{status.uptime}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-text-muted" />
            <span className="text-xs text-text-muted">데이터베이스</span>
          </div>
          <span className="text-xs font-mono tabular-nums text-text-primary">{status.db}</span>
        </div>
      </div>
    </Card>
  )
}
