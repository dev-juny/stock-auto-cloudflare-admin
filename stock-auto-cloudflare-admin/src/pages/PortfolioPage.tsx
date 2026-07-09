import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Tooltip } from '../components/common/Tooltip'
import { findGlossary } from '../utils/glossary'
import {
  Wallet, TrendingUp, TrendingDown, PieChart, BarChart3,
  Plus, Trash2, CheckCircle, XCircle, RefreshCw, LineChart,
  Calendar,
} from 'lucide-react'

interface PortfolioStrategy {
  id: number
  strategy_id: number
  generation: number
  allocation: number
  status: string
  created_at: string
  approved_at: string | null
  fitness: number
  return_pct: number
  win_rate: number
  mdd: number
  total_trades: number
}

interface BacktestResult {
  return_pct: number
  win_rate: number
  mdd: number
  sharpe_ratio: number
  cagr: number
  trade_count: number
  initial_capital: number
  final_value: number
  daily_values: { date: string; value: number }[]
  strategies_tested: number
  tickers_screened: number
}

interface BacktestHistoryItem {
  id: number
  period_start: string
  period_end: string
  initial_capital: number
  return_pct: number
  win_rate: number
  mdd: number
  sharpe_ratio: number
  cagr: number
  trade_count: number
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  candidate: 'bg-amber-500/10 text-amber-400',
  approved: 'bg-green-500/10 text-green-400',
  disabled: 'bg-surface-border text-text-muted',
}

export default function PortfolioPage() {
  const [strategies, setStrategies] = useState<{ items: PortfolioStrategy[]; total_allocation: number } | null>(null)
  const [showBacktest, setShowBacktest] = useState(false)
  const [btResult, setBtResult] = useState<BacktestResult | null>(null)
  const [btHistory, setBtHistory] = useState<BacktestHistoryItem[]>([])
  const [btRunning, setBtRunning] = useState(false)
  const [btPeriod, setBtPeriod] = useState('1y')
  const [btUniverse, setBtUniverse] = useState('KOSPI')
  const [btCapital, setBtCapital] = useState(10000000)

  useEffect(() => { load(); loadHistory() }, [])

  async function load() {
    try {
      const d = await api.get<any>('/api/portfolio/strategies')
      if (d && Array.isArray(d)) {
        setStrategies({ items: d, total_allocation: 0 })
      } else if (d?.items) {
        setStrategies(d)
      } else {
        setStrategies({ items: [], total_allocation: 0 })
      }
    } catch {}
  }

  async function loadHistory() {
    try {
      const d = await api.get<{ items: BacktestHistoryItem[] }>('/api/portfolio/backtest/results')
      setBtHistory(d.items || [])
    } catch {}
  }

  async function updateStrategy(id: number, data: { allocation?: number; status?: string }) {
    try {
      await api.patch(`/api/portfolio/strategies/${id}`, data)
      load()
    } catch {}
  }

  async function removeStrategy(id: number) {
    try {
      await api.delete(`/api/portfolio/strategies/${id}`)
      load()
    } catch {}
  }

  async function runBacktest() {
    setBtRunning(true)
    setBtResult(null)
    try {
      const r = await api.post<BacktestResult>('/api/portfolio/backtest', {
        period: btPeriod,
        universe: btUniverse,
        initial_capital: btCapital,
        strategy_limit: 5,
      })
      setBtResult(r)
      loadHistory()
    } catch {}
    setBtRunning(false)
  }

  const totalAlloc = strategies?.total_allocation || 0
  const maxVal = btResult?.daily_values?.length ? Math.max(...btResult.daily_values.map(d => d.value), btResult.initial_capital) : 0
  const minVal = btResult?.daily_values?.length ? Math.min(...btResult.daily_values.map(d => d.value), btResult.initial_capital) : 0

  return (
    <div className="space-y-4">
      {strategies?.items?.length === 0 ? (
        <div className="bg-surface-card rounded-2xl border border-surface-border p-6 text-center text-xs text-text-muted">
          No strategies in portfolio. Go to Strategy tab to add strategies.
        </div>
      ) : (
        <>
          <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
            <div className="p-3 border-b border-surface-border flex items-center justify-between">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Portfolio Strategies</h3>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                Math.abs(totalAlloc - 100) < 0.01 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>{totalAlloc.toFixed(1)}%</span>
            </div>
            <div className="divide-y divide-surface-border">
              {strategies?.items?.map(s => (
                <div key={s.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text">Gen {s.generation}-{s.strategy_id}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_STYLES[s.status] || ''}`}>{s.status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-primary">{s.allocation.toFixed(1)}%</span>
                      <button onClick={() => removeStrategy(s.id)}
                        className="p-1 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] text-text-muted">
                    <Tooltip content={findGlossary('fitness')?.description ?? 'Fitness'}>
                      <span>Fitness: <span className="text-amber-400">{s.fitness.toFixed(2)}</span></span>
                    </Tooltip>
                    <Tooltip content={findGlossary('return')?.description ?? 'Return'}>
                      <span>Return: <span className={s.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}>{s.return_pct.toFixed(1)}%</span></span>
                    </Tooltip>
                    <Tooltip content={findGlossary('winRate')?.description ?? 'Win'}>
                      <span>Win: <span className="text-blue-400">{s.win_rate.toFixed(1)}%</span></span>
                    </Tooltip>
                  </div>
                  {s.status === 'candidate' && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => updateStrategy(s.id, { status: 'approved' })}
                        className="text-[10px] px-2 py-1 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
                        <CheckCircle size={10} className="inline mr-1" />Approve
                      </button>
                      <button onClick={() => updateStrategy(s.id, { status: 'disabled' })}
                        className="text-[10px] px-2 py-1 rounded-lg bg-surface-border text-text-muted hover:text-text transition-colors">
                        <XCircle size={10} className="inline mr-1" />Disable
                      </button>
                    </div>
                  )}
                  {s.status === 'approved' && (
                    <div className="flex gap-2 mt-2">
                      <input type="range" min="0" max="100" value={s.allocation}
                        onChange={e => updateStrategy(s.id, { allocation: parseFloat(e.target.value) })}
                        className="flex-1 h-1 accent-primary" />
                      <span className="text-[10px] text-text-muted w-8 text-right">{s.allocation.toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
            <div className="p-3 border-b border-surface-border">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Portfolio Backtest</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-text-muted block mb-1">Period</label>
                  <select value={btPeriod} onChange={e => setBtPeriod(e.target.value)}
                    className="w-full bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border">
                    <option value="1y">1 Year</option>
                    <option value="2y">2 Years</option>
                    <option value="3y">3 Years</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-text-muted block mb-1">Universe</label>
                  <select value={btUniverse} onChange={e => setBtUniverse(e.target.value)}
                    className="w-full bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border">
                    <option value="KOSPI">KOSPI</option>
                    <option value="KOSDAQ">KOSDAQ</option>
                    <option value="ALL">KOSPI + KOSDAQ</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-text-muted block mb-1">Initial Capital</label>
                  <input type="number" value={btCapital} onChange={e => setBtCapital(Number(e.target.value))}
                    className="w-full bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border" />
                </div>
                <div className="flex items-end">
                  <button onClick={runBacktest} disabled={btRunning}
                    className="w-full text-xs px-3 py-1.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {btRunning ? 'Running...' : 'Run Backtest'}
                  </button>
                </div>
              </div>

              {btResult && (
                <div className="border-t border-surface-border pt-3 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="bg-surface rounded-xl p-2">
                      <Tooltip content={findGlossary('return')?.description ?? 'Return'}>
                        <span className="text-text-muted">Return</span>
                      </Tooltip>
                      <p className={`text-sm font-bold ${btResult.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {btResult.return_pct >= 0 ? '+' : ''}{btResult.return_pct.toFixed(2)}%
                      </p>
                    </div>
                    <div className="bg-surface rounded-xl p-2">
                      <Tooltip content={findGlossary('winRate')?.description ?? 'Win Rate'}>
                        <span className="text-text-muted">Win Rate</span>
                      </Tooltip>
                      <p className="text-sm font-bold text-blue-400">{btResult.win_rate.toFixed(1)}%</p>
                    </div>
                    <div className="bg-surface rounded-xl p-2">
                      <Tooltip content={findGlossary('mdd')?.description ?? 'MDD'}>
                        <span className="text-text-muted">MDD</span>
                      </Tooltip>
                      <p className="text-sm font-bold text-red-400">{btResult.mdd.toFixed(2)}%</p>
                    </div>
                    <div className="bg-surface rounded-xl p-2">
                      <Tooltip content={findGlossary('sharpe')?.description ?? 'Sharpe'}>
                        <span className="text-text-muted">Sharpe</span>
                      </Tooltip>
                      <p className="text-sm font-bold text-amber-400">{btResult.sharpe_ratio.toFixed(2)}</p>
                    </div>
                    <div className="bg-surface rounded-xl p-2">
                      <Tooltip content={findGlossary('cagr')?.description ?? 'CAGR'}>
                        <span className="text-text-muted">CAGR</span>
                      </Tooltip>
                      <p className={`text-sm font-bold ${btResult.cagr >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {btResult.cagr >= 0 ? '+' : ''}{btResult.cagr.toFixed(2)}%
                      </p>
                    </div>
                    <div className="bg-surface rounded-xl p-2">
                      <Tooltip content={findGlossary('totalTrades')?.description ?? 'Trades'}>
                        <span className="text-text-muted">Trades</span>
                      </Tooltip>
                      <p className="text-sm font-bold text-text">{btResult.trade_count}</p>
                    </div>
                  </div>

                  {btResult?.daily_values?.length > 1 && (
                    <div className="bg-surface rounded-xl p-3">
                      <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Equity Curve</h4>
                      <div className="flex items-end gap-px h-24">
                        {btResult.daily_values.filter((_, i) => i % Math.max(1, Math.floor(btResult.daily_values.length / 60)) === 0).map((d, i) => {
                          const h = ((d.value - minVal) / (maxVal - minVal || 1)) * 100
                          return (
                            <div key={i} className="flex-1 rounded-t-sm bg-primary/60 hover:bg-primary/80 transition-colors"
                              style={{ height: `${Math.max(h, 2)}%` }}
                              title={`${d.date}: ₩${d.value.toLocaleString()}`} />
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-text-muted">
                    Strategies tested: {btResult.strategies_tested} &middot; Tickers screened: {btResult.tickers_screened} &middot;
                    Capital: ₩{btResult.initial_capital.toLocaleString()} → ₩{btResult.final_value.toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {btHistory.length > 0 && (
            <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
              <div className="p-3 border-b border-surface-border">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Backtest History</h3>
              </div>
              <div className="divide-y divide-surface-border">
                {btHistory.slice(0, 5).map(h => (
                  <div key={h.id} className="px-4 py-2 text-[11px] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar size={10} className="text-text-muted" />
                      <span className="text-text-muted">{h.period_start} ~ {h.period_end}</span>
                    </div>
                    <div className="flex gap-3">
                      <Tooltip content={findGlossary('return')?.description ?? 'Return'}>
                        <span className={h.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}>{h.return_pct >= 0 ? '+' : ''}{h.return_pct.toFixed(1)}%</span>
                      </Tooltip>
                      <Tooltip content={findGlossary('mdd')?.description ?? 'MDD'}>
                        <span className="text-text-muted">MDD {h.mdd.toFixed(1)}%</span>
                      </Tooltip>
                      <Tooltip content={findGlossary('sharpe')?.description ?? 'Sharpe'}>
                        <span className="text-amber-400">Sharpe {h.sharpe_ratio.toFixed(2)}</span>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
