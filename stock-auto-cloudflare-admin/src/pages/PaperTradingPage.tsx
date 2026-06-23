import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import {
  Wallet, TrendingUp, TrendingDown, RefreshCw, Play,
  CheckCircle, XCircle, Activity,
} from 'lucide-react'

interface PaperStatus {
  cash: number
  total_value: number
  invested: number
  positions_count: number
  total_trades: number
  total_pnl: number
  broker: string
}

interface Signal {
  ticker: string
  name: string
  signal: string
  price: number
  strategy_id: number
  generation: number
}

interface Position {
  id: number
  strategy_id: number
  ticker: string
  entry_price: number
  current_price: number
  quantity: number
  entry_date: string
  pnl_pct: number
  pnl_amt: number
  status: string
}

interface Trade {
  id: number
  strategy_id: number
  ticker: string
  action: string
  price: number
  quantity: number
  pnl_pct: number
  trade_date: string
  reason: string
}

export default function PaperTradingPage() {
  const [status, setStatus] = useState<PaperStatus | null>(null)
  const [signals, setSignals] = useState<Signal[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [execResult, setExecResult] = useState<string | null>(null)
  const activeTab = window.location.hash?.includes('trades') ? 'trades' : 'positions'

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const [s, p, t] = await Promise.all([
        api.get<PaperStatus>('/api/paper-trading/status').catch(() => null),
        api.get<{ items: Position[] }>('/api/paper-trading/positions').catch(() => null),
        api.get<{ items: Trade[] }>('/api/paper-trading/trades').catch(() => null),
      ])
      if (s) setStatus(s)
      if (p) setPositions(p.items || [])
      if (t) setTrades(t.items || [])
    } catch {} finally {
      setLoading(false)
    }
  }

  async function generateAndExecute() {
    setExecuting(true)
    setExecResult(null)
    try {
      const sig = await api.post<{ signals: Signal[]; count: number }>('/api/paper-trading/signals')
      setSignals(sig.signals || [])
      if ((sig.signals || []).length > 0) {
        const r = await api.post<{ results: any[]; count: number }>('/api/paper-trading/execute', { signals: sig.signals })
        setExecResult(`Executed ${r.count} trades`)
      } else {
        setExecResult('No signals generated')
      }
      loadAll()
    } catch (e: any) {
      setExecResult(`Error: ${e.message || 'Unknown'}`)
    }
    setExecuting(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-xs text-text-muted">Loading paper trading...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">Paper Trading</h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Mock Broker</span>
      </div>

      {status && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-surface-card rounded-2xl p-4 border border-surface-border">
            <div className="flex items-center gap-1.5 text-text-muted mb-1">
              <Wallet size={14} />
              <span className="text-[10px] font-medium">Total Value</span>
            </div>
            <div className="text-lg font-bold text-text">₩{status.total_value.toLocaleString()}</div>
          </div>
          <div className="bg-surface-card rounded-2xl p-4 border border-surface-border">
            <div className="flex items-center gap-1.5 text-text-muted mb-1">
              <TrendingUp size={14} />
              <span className="text-[10px] font-medium">Cash</span>
            </div>
            <div className="text-lg font-bold text-blue-400">₩{status.cash.toLocaleString()}</div>
          </div>
          <div className="bg-surface-card rounded-2xl p-4 border border-surface-border">
            <div className="flex items-center gap-1.5 text-text-muted mb-1">
              <Activity size={14} />
              <span className="text-[10px] font-medium">Positions</span>
            </div>
            <div className="text-lg font-bold text-amber-400">{status.positions_count}</div>
          </div>
          <div className="bg-surface-card rounded-2xl p-4 border border-surface-border">
            <div className="flex items-center gap-1.5 text-text-muted mb-1">
              <TrendingDown size={14} />
              <span className="text-[10px] font-medium">Total P&L</span>
            </div>
            <div className={`text-lg font-bold ${status.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {status.total_pnl >= 0 ? '+' : ''}₩{Math.abs(status.total_pnl).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={generateAndExecute} disabled={executing}
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
          <Play size={12} /> {executing ? 'Running...' : 'Generate Signals & Execute'}
        </button>
        <button onClick={loadAll} className="p-2 text-text-muted hover:text-text transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      {execResult && (
        <div className="text-xs px-3 py-2 rounded-lg bg-primary/10 text-primary">{execResult}</div>
      )}

      {signals.length > 0 && (
        <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
          <div className="p-3 border-b border-surface-border">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Signals Generated ({signals.length})</h3>
          </div>
          <div className="divide-y divide-surface-border max-h-40 overflow-y-auto">
            {signals.map((sig, i) => (
              <div key={i} className="px-4 py-2 text-[11px] flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  sig.signal === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>{sig.signal}</span>
                <span className="text-text font-medium">{sig.name}</span>
                <span className="text-text-muted">{sig.ticker}</span>
                <span className="text-text-muted ml-auto">₩{sig.price.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
        <div className="p-3 border-b border-surface-border flex items-center gap-4">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Open Positions</h3>
          <span className="text-[10px] text-text-muted">{positions.filter(p => p.status === 'open').length} open</span>
        </div>
        {positions.filter(p => p.status === 'open').length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">No open positions</div>
        ) : (
          <div className="divide-y divide-surface-border">
            {positions.filter(p => p.status === 'open').map(p => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-text">{p.ticker}</span>
                    <span className="text-[10px] text-text-muted">S{p.strategy_id}</span>
                  </div>
                  <div className="text-[10px] text-text-muted mt-0.5">
                    Entry: ₩{p.entry_price.toLocaleString()} &middot; Qty: {p.quantity}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${p.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {p.pnl_pct >= 0 ? '+' : ''}{p.pnl_pct.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {p.pnl_amt >= 0 ? '+' : ''}₩{Math.abs(p.pnl_amt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
        <div className="p-3 border-b border-surface-border">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Recent Trades</h3>
        </div>
        {trades.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">No trades yet</div>
        ) : (
          <div className="divide-y divide-surface-border max-h-60 overflow-y-auto">
            {trades.slice(0, 30).map(t => (
              <div key={t.id} className="px-4 py-2 text-[11px] flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  t.action === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>{t.action}</span>
                <span className="text-text font-medium">{t.ticker}</span>
                <span className="text-text-muted">₩{t.price.toLocaleString()} x {t.quantity}</span>
                {t.pnl_pct !== 0 && (
                  <span className={t.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}>{t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct.toFixed(2)}%</span>
                )}
                <span className="text-text-muted ml-auto">{t.reason || '-'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
