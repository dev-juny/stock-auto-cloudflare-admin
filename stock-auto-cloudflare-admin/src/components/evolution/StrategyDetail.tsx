import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ShieldCheck, TrendingUp, TrendingDown, Activity, Zap, BarChart3, GitBranch } from 'lucide-react'
import type { EvolutionStrategy } from '../../utils/api'

interface Props {
  strategy: EvolutionStrategy
  onClose: () => void
}

function DetailContent({ strategy, onClose }: Props) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  const s = strategy
  const p = s.params
  const ind = s.indicators

  const paramRows = [
    { label: 'Entry Type', value: p?.entry_type, icon: Zap },
    { label: 'Entry Trigger', value: p?.entry_trigger, icon: Activity },
    { label: 'Min Volume', value: p?.min_volume?.toLocaleString(), icon: BarChart3 },
    { label: 'Max Volatility', value: p?.max_volatility ? `${(p.max_volatility * 100).toFixed(1)}%` : '-', icon: TrendingDown },
    { label: 'Take Profit', value: p?.fixed_take_profit_pct ? `${(p.fixed_take_profit_pct * 100).toFixed(1)}%` : '-', icon: TrendingUp },
    { label: 'Stop Loss', value: p?.stop_loss_pct ? `${(p.stop_loss_pct * 100).toFixed(1)}%` : '-', icon: TrendingDown },
    { label: 'Trailing Stop', value: p?.trailing_stop_pct ? `${(p.trailing_stop_pct * 100).toFixed(1)}%` : '-', icon: GitBranch },
    { label: 'Stall Exit', value: p?.stall_exit_days ? `${p.stall_exit_days}d` : '-', icon: X },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface-card rounded-t-2xl sm:rounded-2xl max-h-[80vh] overflow-y-auto border border-surface-border">
        <div className="sticky top-0 bg-surface-card border-b border-surface-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {s.is_elite && <ShieldCheck size={16} className="text-amber-400" />}
            <h3 className="text-sm font-bold text-text">{s.name}</h3>
            {s.is_elite && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium">ELITE</span>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Generation" value={`#${s.generation}`} color="text-primary" />
            <StatCard label="Version" value={`v${s.version}`} color="text-blue-400" />
            <StatCard label="Total Return" value={s.total_trades > 0 ? `${(s.total_return ?? 0) >= 0 ? '+' : ''}${(s.total_return ?? 0).toFixed(2)}%` : '-'}
              color={(s.total_return ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'} />
            <StatCard label="Win Rate" value={s.total_trades > 0 ? `${(s.win_rate ?? 0).toFixed(1)}%` : '-'}
              color={(s.win_rate ?? 0) >= 50 ? 'text-green-400' : 'text-red-400'} />
            <StatCard label="Max DD" value={s.total_trades > 0 ? `${(s.max_drawdown ?? 0).toFixed(1)}%` : '-'} color="text-red-400" />
            <StatCard label="Trades" value={s.total_trades.toString()} color="text-text" />
          </div>

          <div>
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Parameters</h4>
            <div className="grid grid-cols-2 gap-1.5">
              {paramRows.map((row) => {
                const Icon = row.icon
                return (
                  <div key={row.label} className="flex items-center gap-1.5 bg-surface rounded-lg px-2.5 py-1.5">
                    <Icon size={10} className="text-text-muted shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[9px] text-text-muted">{row.label}</div>
                      <div className="text-[11px] font-medium text-text truncate">{row.value}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {ind && (
            <div>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Indicators</h4>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Volume', on: ind.use_volume_filter },
                  { label: 'Volatility', on: ind.use_volatility_filter },
                  { label: 'Momentum', on: ind.use_momentum },
                  { label: 'Breakout', on: ind.use_breakout },
                  { label: 'Pullback', on: ind.use_pullback },
                ].map((f) => (
                  <span key={f.label} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    f.on ? 'bg-green-500/10 text-green-400' : 'bg-surface-border/50 text-text-muted'
                  }`}>
                    {f.label}: {f.on ? 'ON' : 'OFF'}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                <div className="bg-surface rounded-lg px-2 py-1.5 text-center">
                  <div className="text-[9px] text-text-muted">Momentum</div>
                  <div className="text-[11px] font-medium text-text">{ind.momentum_period}</div>
                </div>
                <div className="bg-surface rounded-lg px-2 py-1.5 text-center">
                  <div className="text-[9px] text-text-muted">Breakout</div>
                  <div className="text-[11px] font-medium text-text">{ind.breakout_period}</div>
                </div>
                <div className="bg-surface rounded-lg px-2 py-1.5 text-center">
                  <div className="text-[9px] text-text-muted">Pullback</div>
                  <div className="text-[11px] font-medium text-text">{ind.pullback_threshold}</div>
                </div>
              </div>
            </div>
          )}

          {s.tags && s.tags.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Tags</h4>
              <div className="flex flex-wrap gap-1">
                {s.tags.map((tag, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function StrategyDetail(props: Props) {
  return createPortal(<DetailContent {...props} />, document.body)
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface rounded-xl p-3">
      <div className="text-[10px] text-text-muted mb-0.5">{label}</div>
      <div className={`text-sm font-bold ${color}`}>{value}</div>
    </div>
  )
}
