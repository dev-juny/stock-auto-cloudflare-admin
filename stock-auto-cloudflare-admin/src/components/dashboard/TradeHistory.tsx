import { useTrades } from '../../hooks/useTrades'
import { Card } from '../common/Card'
import { CardSkeleton } from '../common/Skeleton'
import { formatKRW, formatTime } from '../../utils/format'

export function TradeHistory() {
  const { trades, loading } = useTrades()

  if (loading) return <CardSkeleton />

  const recent = trades.slice(0, 5)

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary">최근 거래</h2>
        {trades.length > 5 && (
          <span className="text-[11px] text-text-muted">{trades.length}건</span>
        )}
      </div>
      {recent.length === 0 ? (
        <p className="text-xs text-text-muted">거래 내역이 없습니다</p>
      ) : (
        <div className="space-y-1">
          {recent.map((t, i) => {
            const isBuy = t.action === 'BUY'
            const isPositive = t.pnl && t.pnl >= 0
            return (
              <div
                key={t.id || i}
                className="flex items-center gap-3 py-2 border-b border-surface-border last:border-0"
              >
                <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isBuy ? 'bg-primary' : 'bg-danger'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text-primary">
                      {t.name || t.ticker || '거래'}
                    </span>
                    <span className={`text-[10px] font-medium ${isBuy ? 'text-primary' : 'text-danger'}`}>
                      {t.action}
                    </span>
                  </div>
                  <div className="text-[11px] text-text-muted font-mono tabular-nums">
                    {formatTime(t.traded_at)} · {formatKRW(t.price)} · {t.quantity}주
                  </div>
                </div>
                {t.pnl !== undefined && (
                  <div className={`text-xs font-semibold font-mono tabular-nums ${isPositive ? 'text-success' : 'text-danger'}`}>
                    {isPositive ? '+' : ''}{formatKRW(t.pnl)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {trades.length > 5 && (
        <button className="w-full text-center text-xs text-text-muted hover:text-text-primary mt-2 min-h-[36px] transition-colors">
          전체 거래 내역 보기
        </button>
      )}
    </Card>
  )
}
