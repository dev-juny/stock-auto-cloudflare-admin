import { useState, useEffect } from 'react'
import { Card } from '../common/Card'
import { CardSkeleton } from '../common/Skeleton'
import { formatKRW, formatPct, formatStockDisplay } from '../../utils/format'
import { api, PositionEntry } from '../../utils/api'

export function PositionsCard() {
  const [positions, setPositions] = useState<PositionEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<PositionEntry[]>('/api/positions')
      .then((list) => setPositions(Array.isArray(list) ? list : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <CardSkeleton />

  if (positions.length === 0) {
    return (
      <Card>
        <h2 className="text-sm font-semibold text-text-primary mb-2">보유 포지션</h2>
        <p className="text-xs text-text-muted">활성 포지션이 없습니다</p>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary">보유 포지션</h2>
        <span className="text-[11px] text-text-muted">{positions.length}개</span>
      </div>
      <div className="space-y-1">
        {positions.map((p) => {
          const isPositive = p.pnl_pct >= 0
          return (
            <div
              key={p.ticker}
              className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-surface border border-surface-border"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">{formatStockDisplay(p.name, p.ticker)}</div>
                <div className="text-[11px] text-text-muted font-mono tabular-nums">
                  {p.quantity}주 @ {formatKRW(p.entry_price)}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-semibold font-mono tabular-nums ${isPositive ? 'text-success' : 'text-danger'}`}>
                  {formatPct(p.pnl_pct)}
                </div>
                <div className={`text-[11px] font-mono tabular-nums ${isPositive ? 'text-success' : 'text-danger'}`}>
                  {isPositive ? '+' : ''}{formatKRW(p.pnl_amount)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
