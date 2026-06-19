import { useEffect, useState } from 'react'
import { api, type EvolutionConfig } from '../utils/api'
import { Settings, Activity, BarChart3, GitBranch, Repeat, ToggleLeft, Timer } from 'lucide-react'

interface SystemStatus {
  db_connected: boolean
  service: string
  timestamp: string
  timestamp_kst?: string
  active_strategies: number
  total_generations: number
}

export function Dashboard() {
  const [config, setConfig] = useState<EvolutionConfig | null>(null)
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null)

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  async function load() {
    try {
      const [cfg, status] = await Promise.all([
        api.get<EvolutionConfig>('/api/evolution/config'),
        api.get<SystemStatus>('/api/system/status'),
      ])
      setConfig(cfg)
      setSysStatus(status)
    } catch {}
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-text">Dashboard</h2>

      {sysStatus && (
        <div className="bg-surface-card rounded-2xl border border-surface-border p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Activity size={14} className="text-primary" />
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">System Status</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatusItem label="Database" value={sysStatus.db_connected ? 'Connected' : 'Disconnected'} color={sysStatus.db_connected ? 'text-green-400' : 'text-red-400'} />
            <StatusItem label="Active Strategies" value={String(sysStatus.active_strategies)} color="text-blue-400" />
            <StatusItem label="Total Generations" value={String(sysStatus.total_generations)} color="text-amber-400" />
            <StatusItem label="KST" value={sysStatus.timestamp_kst?.slice(0, 19) || '-'} color="text-text-muted" />
          </div>
        </div>
      )}

      {config && (
        <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
          <div className="p-3 border-b border-surface-border">
            <div className="flex items-center gap-1.5">
              <Settings size={14} className="text-primary" />
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Active Settings (Evolution Engine)</span>
            </div>
          </div>
          <div className="divide-y divide-surface-border">
            <SettingsRow icon={BarChart3} label="Population Size" value={String(config.population_size)} />
            <SettingsRow icon={GitBranch} label="Mutation Rate" value={`${(config.mutation_rate * 100).toFixed(0)}%`} />
            <SettingsRow icon={Repeat} label="Crossover Rate" value={`${(config.crossover_rate * 100).toFixed(0)}%`} />
            <SettingsRow icon={ToggleLeft} label="Auto Evolution" value={config.evolution_enabled ? 'Enabled' : 'Disabled'} color={config.evolution_enabled ? 'text-green-400' : 'text-red-400'} />
            <SettingsRow icon={Timer} label="Backtest Interval" value={`${config.min_generation_interval_hours}h`} />
            <SettingsRow icon={Activity} label="MDD Threshold" value={`${config.mdd_threshold}%`} />
            <SettingsRow icon={Activity} label="Win Rate Threshold" value={`${config.winrate_threshold}%`} />
            <SettingsRow icon={Activity} label="Return Threshold" value={`${config.return_threshold}%`} />
          </div>
        </div>
      )}
    </div>
  )
}

function StatusItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface rounded-xl p-3">
      <div className="text-[10px] text-text-muted mb-1">{label}</div>
      <div className={`text-sm font-bold ${color}`}>{value}</div>
    </div>
  )
}

function SettingsRow({ icon: Icon, label, value, color = 'text-text' }: { icon: any; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="flex items-center gap-2">
        <Icon size={12} className="text-text-muted" />
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <span className={`text-xs font-semibold ${color}`}>{value}</span>
    </div>
  )
}
