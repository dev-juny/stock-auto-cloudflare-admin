import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Save, RotateCw, RefreshCw } from 'lucide-react'

interface Settings {
  backtest_interval: string
  evolution_enabled: boolean
  population_size: number
  mutation_rate: number
  crossover_rate: number
  elite_ratio: number
  tournament_size: number
  max_generations: number
  fitness_return_weight: number
  fitness_winrate_weight: number
  fitness_mdd_penalty: number
  mdd_threshold: number
  winrate_threshold: number
  return_threshold: number
  [key: string]: string | number | boolean
}

const settingMeta: Record<string, { label: string; type: 'select' | 'number' | 'boolean'; options?: string[]; min?: number; max?: number; step?: number; help?: string }> = {
  backtest_interval: { label: 'Backtest Interval', type: 'select', options: ['30m', '1h', '4h', '1d'] },
  evolution_enabled: { label: 'Auto Evolution', type: 'boolean' },
  population_size: { label: 'Population Size', type: 'number', min: 10, max: 200, step: 10 },
  mutation_rate: { label: 'Mutation Rate', type: 'number', min: 0, max: 1, step: 0.05 },
  crossover_rate: { label: 'Crossover Rate', type: 'number', min: 0, max: 1, step: 0.05 },
  elite_ratio: { label: 'Elite Ratio', type: 'number', min: 0.05, max: 0.5, step: 0.05 },
  tournament_size: { label: 'Tournament Size', type: 'number', min: 2, max: 20, step: 1 },
  max_generations: { label: 'Max Generations', type: 'number', min: 0, max: 500, step: 10, help: '0 = unlimited, 1+ = stop after N generations' },
  fitness_return_weight: { label: 'Fitness: Return Weight', type: 'number', min: 0, max: 1, step: 0.1 },
  fitness_winrate_weight: { label: 'Fitness: Win Rate Weight', type: 'number', min: 0, max: 1, step: 0.1 },
  fitness_mdd_penalty: { label: 'Fitness: MDD Penalty', type: 'number', min: 0, max: 1, step: 0.1 },
  mdd_threshold: { label: 'MDD Trigger (%)', type: 'number', min: 1, max: 50, step: 1 },
  winrate_threshold: { label: 'Win Rate Trigger (%)', type: 'number', min: 10, max: 90, step: 5 },
  return_threshold: { label: 'Return Trigger (%)', type: 'number', min: -50, max: 50, step: 5 },
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const s = await api.get<Settings>('/api/settings')
      setSettings(s)
    } catch {}
  }

  async function save() {
    if (!settings) return
    setSaving(true)
    try {
      await api.post('/api/settings', settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  async function reloadConfig() {
    try {
      await api.post('/api/evolution/config/reload')
      alert('Config reloaded from DB into Evolution Engine')
    } catch {
      alert('Failed to reload config')
    }
  }

  function update(key: string, value: string | number | boolean) {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
  }

  if (!settings) {
    return <div className="flex items-center justify-center h-48 text-xs text-text-muted">Loading settings...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">Settings</h2>
        <div className="flex items-center gap-2">
          {saved && <span className="text-[11px] text-green-400 font-medium">Saved!</span>}
          <button onClick={reloadConfig}
            className="flex items-center gap-1 px-3 py-1.5 bg-surface-card text-text-muted text-xs font-medium rounded-lg border border-surface-border hover:text-text transition-colors">
            <RefreshCw size={12} />
            Apply to Engine
          </button>
          <button onClick={() => { load(); setSaved(false) }}
            className="p-2 text-text-muted hover:text-text transition-colors">
            <RotateCw size={14} />
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg disabled:opacity-50">
            <Save size={12} />
            Save
          </button>
        </div>
      </div>

      <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
        <div className="p-3 border-b border-surface-border">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Evolution & Backtest</span>
        </div>
        <div className="divide-y divide-surface-border">
          {Object.entries(settingMeta).map(([key, meta]) => (
            <div key={key} className="px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <label className="text-sm text-text">{meta.label}</label>
                {meta.help && <p className="text-[10px] text-text-muted mt-0.5">{meta.help}</p>}
              </div>
              <div className="shrink-0">
                {meta.type === 'select' ? (
                  <select value={String(settings[key])} onChange={(e) => update(key, e.target.value)}
                    className="bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border focus:outline-none focus:border-primary min-w-[72px]">
                    {meta.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : meta.type === 'boolean' ? (
                  <button onClick={() => update(key, !settings[key])}
                    className={`w-10 h-5 rounded-full transition-colors relative ${settings[key] ? 'bg-primary' : 'bg-surface-border'}`}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${settings[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                ) : (
                  <input type="number" value={Number(settings[key])} min={meta.min} max={meta.max} step={meta.step}
                    onChange={(e) => update(key, parseFloat(e.target.value) || 0)}
                    className="w-20 bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border focus:outline-none focus:border-primary text-right" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
