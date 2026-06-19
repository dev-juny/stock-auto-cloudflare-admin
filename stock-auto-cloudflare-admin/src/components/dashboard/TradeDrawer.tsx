import { X, TrendingUp, TrendingDown } from 'lucide-react'
import { TradeEntry } from '../../utils/api'
import { formatKRW, formatPct, formatTime } from '../../utils/format'

interface TradeDrawerProps {
  trades: TradeEntry[]
  open: boolean
  onClose: () => void
}

export function TradeDrawer({ trades, open, onClose }: TradeDrawerProps) {
  if (!open) return null

  const totalWin = trades.filter((t) => t.pnl && t.pnl > 0).length
  const totalLoss = trades.filter((t) => t.pnl && t.pnl < 0).length

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] bg-surface-card border border-surface-border rounded-t-2xl overflow-hidden animate-slide-up">
        <div className="sticky top-0 bg-surface-card border-b border-surface-border px-5 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">전체 거래 내역</h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              총 {trades.length}건 · 승리 {totalWin} · 패배 {totalLoss}
            </p>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-text-muted hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 64px)' }}>
          {trades.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">거래 내역이 없습니다</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-card">
                <tr className="text-text-muted border-b border-surface-border">
                  <th className="text-left px-4 py-2.5 font-medium">종목</th>
                  <th className="text-right px-2 py-2.5 font-medium">구분</th>
                  <th className="text-right px-2 py-2.5 font-medium">수량</th>
                  <th className="text-right px-2 py-2.5 font-medium">가격</th>
                  <th className="text-right px-3 py-2.5 font-medium">손익</th>
                  <th className="text-left px-3 py-2.5 font-medium">사유</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, i) => {
                  const isBuy = t.action === 'BUY'
                  const pnl = t.pnl ?? 0
                  const isPositive = pnl >= 0
                  return (
                    <tr key={t.id || i} className="border-b border-surface-border hover:bg-surface-hover/40">
                      <td className="px-4 py-2.5">
                        <div className="text-text-primary font-medium">{t.name || t.ticker || '-'}</div>
                      </td>
                      <td className={`px-2 py-2.5 text-right font-medium ${isBuy ? 'text-primary' : 'text-danger'}`}>
                        {isBuy ? '매수' : '매도'}
                      </td>
                      <td className="px-2 py-2.5 text-right text-text-muted font-mono tabular-nums">
                        {t.quantity || '-'}
                      </td>
                      <td className="px-2 py-2.5 text-right text-text-primary font-mono tabular-nums">
                        {t.price ? formatKRW(t.price) : '-'}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono tabular-nums font-medium ${isPositive ? 'text-success' : 'text-danger'}`}>
                        <div className="flex items-center justify-end gap-1">
                          {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                          {formatKRW(pnl)}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-text-muted text-[10px]">
                        <span className="bg-surface border border-surface-border rounded px-1.5 py-0.5">{t.reason || '-'}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
