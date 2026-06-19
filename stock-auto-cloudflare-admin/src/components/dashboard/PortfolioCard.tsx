import { ChevronRight } from 'lucide-react'
import { Card } from '../common/Card'
import { CardSkeleton } from '../common/Skeleton'
import { formatKRW, formatPct } from '../../utils/format'
import { PortfolioData } from '../../hooks/useBalance'

interface PortfolioCardProps {
  data: PortfolioData | null
  loading: boolean
}

export function PortfolioCard({ data, loading }: PortfolioCardProps) {
  if (loading) return <CardSkeleton />

  if (!data || data.holdings.length === 0) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-primary">계좌 정보</h2>
        </div>
        <p className="text-xs text-text-muted">보유 종목이 없습니다</p>
      </Card>
    )
  }

  const topHoldings = data.holdings.slice(0, 3)

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary">계좌 정보</h2>
        <span className="text-[11px] text-text-muted">{data.holdings.length}종목</span>
      </div>

      <div className="space-y-2">
        {topHoldings.map((h) => {
          const pnl = Number(h.evlu_pfls_amt || 0)
          const pnlPct = Number(h.pfls_rt || 0)
          const isPositive = pnl >= 0

          return (
            <div key={h.pdno} className="flex items-center gap-3 py-2 border-b border-surface-border last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">{h.prdt_name}</div>
                <div className="text-[11px] text-text-muted font-mono tabular-nums">
                  {formatKRW(h.evlu_amt)}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-semibold font-mono tabular-nums ${isPositive ? 'text-success' : 'text-danger'}`}>
                  {formatPct(pnlPct)}
                </div>
                <div className={`text-[11px] font-mono tabular-nums ${isPositive ? 'text-success' : 'text-danger'}`}>
                  {isPositive ? '+' : ''}{formatKRW(pnl)}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {data.holdings.length > 3 && (
        <button className="w-full flex items-center justify-center gap-1 mt-3 text-xs text-text-muted hover:text-text-primary transition-colors min-h-[36px]">
          모든 종목 보기 <ChevronRight size={14} />
        </button>
      )}
    </Card>
  )
}
