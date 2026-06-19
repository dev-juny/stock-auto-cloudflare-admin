import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Wallet, TrendingUp, TrendingDown, PieChart, BarChart3 } from 'lucide-react'

interface Holding {
  ticker: string
  name: string
  entry_price: number
  current_price: number
  quantity: number
  pnl_pct: number
  pnl_amt: number
  allocation: number
}

interface PortfolioData {
  total_value: number
  cash: number
  invested: number
  pnl_pct: number
  pnl_amt: number
  positions_count: number
  holdings: Holding[]
}

interface Snapshot {
  date: string
  date_kst?: string
  total_value: number
  pnl_pct: number
}

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioData | null>(null)
  const [perf, setPerf] = useState<Snapshot[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [p, pf] = await Promise.all([
          api.get<PortfolioData>('/api/portfolio'),
          api.get<{ snapshots: Snapshot[] }>('/api/portfolio/performance'),
        ])
        setData(p)
        setPerf(pf.snapshots || [])
      } catch {}
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  if (!data) {
    return <div className="flex items-center justify-center h-48 text-xs text-text-muted">Loading portfolio...</div>
  }

  const latestPnl = data.pnl_pct
  const maxVal = Math.max(...perf.map(s => s.total_value), 1)
  const minVal = Math.min(...perf.map(s => s.total_value), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard icon={Wallet} label="Total Value" value={`₩${data.total_value.toLocaleString()}`} color="text-text" />
        <SummaryCard icon={TrendingUp} label="P&L %" value={`${latestPnl >= 0 ? '+' : ''}${latestPnl.toFixed(2)}%`}
          color={latestPnl >= 0 ? 'text-green-400' : 'text-red-400'} />
        <SummaryCard icon={PieChart} label="Invested" value={`₩${data.invested.toLocaleString()}`} color="text-blue-400" />
        <SummaryCard icon={BarChart3} label="Positions" value={data.positions_count.toString()} color="text-amber-400" />
      </div>

      {perf.length > 1 && (
        <div className="bg-surface-card rounded-2xl p-4 border border-surface-border">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Portfolio Value</h3>
          <div className="flex items-end gap-0.5 h-20">
            {perf.slice(0, 60).reverse().map((s, i) => {
              const h = ((s.total_value - minVal) / (maxVal - minVal || 1)) * 100
              return (
                <div key={i} className="flex-1 rounded-t-sm bg-primary/60 hover:bg-primary/80 transition-colors"
                  style={{ height: `${Math.max(h, 2)}%` }}
                  title={`${s.date_kst || s.date}: ₩${s.total_value.toLocaleString()}`} />
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
        <div className="p-3 border-b border-surface-border">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Holdings</h3>
        </div>
        {data.holdings.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">No active holdings</div>
        ) : (
          <div className="divide-y divide-surface-border">
            {data.holdings.map((h, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-text truncate">{h.name || h.ticker}</span>
                    <span className="text-[10px] text-text-muted">{h.ticker}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-muted">
                    <span>Entry: ₩{h.entry_price?.toLocaleString()}</span>
                    <span>Qty: {h.quantity}</span>
                    {h.allocation > 0 && <span>Alloc: {h.allocation.toFixed(1)}%</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${h.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {h.pnl_pct >= 0 ? '+' : ''}{h.pnl_pct?.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-text-muted">₩{Math.abs(h.pnl_amt || 0).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-surface-card rounded-2xl p-4 border border-surface-border">
      <div className="flex items-center gap-1.5 text-text-muted mb-1.5">
        <Icon size={14} />
        <span className="text-[10px] font-medium">{label}</span>
      </div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  )
}
