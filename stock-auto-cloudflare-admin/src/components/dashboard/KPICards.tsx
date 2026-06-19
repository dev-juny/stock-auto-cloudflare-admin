import { Wallet, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { Card } from '../common/Card'
import { CardSkeleton } from '../common/Skeleton'
import { Badge } from '../common/Badge'
import { formatKRW, formatPct } from '../../utils/format'
import { PortfolioData } from '../../hooks/useBalance'
import { SystemStatus } from '../../hooks/useHealth'

interface KPICardsProps {
  portfolio: PortfolioData | null
  systemStatus: SystemStatus
  loading: boolean
}

export function KPICards({ portfolio, systemStatus, loading }: KPICardsProps) {
  const items = [
    {
      icon: Wallet,
      label: '총 자산',
      value: portfolio ? formatKRW(portfolio.totalAssets) : '-',
      sub: portfolio ? `현금 ${formatKRW(portfolio.cash)}` : '-',
      color: 'text-primary',
    },
    {
      icon: TrendingUp,
      label: '실현 손익',
      value: portfolio ? formatKRW(portfolio.totalPnl) : '-',
      sub: portfolio ? formatPct(portfolio.totalPnlPct) : '-',
      color: portfolio && portfolio.totalPnl >= 0 ? 'text-success' : 'text-danger',
    },
    {
      icon: Activity,
      label: '수익률',
      value: portfolio ? formatPct(portfolio.totalPnlPct) : '-',
      sub: portfolio ? `${portfolio.holdings.length}종목 보유` : '-',
      color: portfolio && portfolio.totalPnlPct >= 0 ? 'text-success' : 'text-danger',
    },
    {
      icon: TrendingDown,
      label: '시스템 상태',
      value: (
        <Badge
          variant={
            systemStatus.status === 'online' ? 'success' :
            systemStatus.status === 'warning' ? 'warning' : 'danger'
          }
        >
          {systemStatus.status === 'online' ? '정상' :
           systemStatus.status === 'warning' ? '주의' : '오프라인'}
        </Badge>
      ),
      sub: `가동 ${systemStatus.uptime}`,
      color: '',
    },
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Card key={item.label}>
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} className="text-text-muted" />
              <span className="text-xs text-text-muted">{item.label}</span>
            </div>
            <div className={`kpi-value ${typeof item.value === 'string' ? item.color : ''}`}>
              {item.value}
            </div>
            <div className="text-[11px] text-text-muted mt-1">{item.sub}</div>
          </Card>
        )
      })}
    </div>
  )
}
