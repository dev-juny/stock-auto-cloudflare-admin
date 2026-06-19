import { useState } from 'react'
import { useTrades } from '../../hooks/useTrades'
import { Card } from '../common/Card'
import { CardSkeleton } from '../common/Skeleton'
import { TradeDrawer } from './TradeDrawer'
import { formatPct } from '../../utils/format'
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react'

export function TradeHistory() {
  const { trades, loading } = useTrades()
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (loading) return <CardSkeleton />

  const recent = trades.slice(0, 5)
  const totalWin = trades.filter((t) => t.pnl && t.pnl > 0).length
  const winRate = trades.length > 0 ? ((totalWin / trades.length) * 100).toFixed(1) : '0.0'

  return (
    <>
      <Card>
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-full flex items-center justify-between mb-3 min-h-[36px]"
        >
          <h2 className="text-sm font-semibold text-text-primary">거래 내역</h2>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted">
              {trades.length}건 · 승률 {winRate}%
            </span>
            {trades.length > 5 && <ExternalLink size={13} className="text-text-muted" />}
          </div>
        </button>

        {recent.length === 0 ? (
          <p className="text-xs text-text-muted py-4 text-center">거래 내역이 없습니다</p>
        ) : (
          <div className="space-y-0.5">
            {recent.map((t, i) => {
              const isBuy = t.action === 'BUY'
              const pnl = t.pnl ?? 0
              const isPositive = pnl >= 0
              const pnlPct = t.pnl_pct ?? 0

              return (
                <button
                  key={t.id || i}
                  onClick={() => setDrawerOpen(true)}
                  className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-surface-hover transition-colors min-h-[44px]"
                >
                  <div className={`w-1 h-8 rounded-full flex-shrink-0 ${isBuy ? 'bg-primary' : 'bg-danger'}`} />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {t.name || t.ticker || '거래'}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.25 rounded ${isBuy ? 'bg-primary/15 text-primary' : 'bg-danger/15 text-danger'}`}>
                        {isBuy ? 'B' : 'S'}
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted font-mono tabular-nums">
                      {t.reason || '-'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`flex items-center gap-1 text-sm font-semibold font-mono tabular-nums ${isPositive ? 'text-success' : 'text-danger'}`}>
                      {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {formatPct(pnlPct)}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {trades.length > 5 && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-full text-center text-xs text-text-muted hover:text-text-primary mt-2 min-h-[36px] transition-colors"
          >
            전체 {trades.length}건 보기
          </button>
        )}
      </Card>

      <TradeDrawer
        trades={trades}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  )
}
