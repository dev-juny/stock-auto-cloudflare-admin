import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { useToast } from '../components/common/Toast'
import { useAction } from '../hooks/useAction'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { Save, RotateCw, Play, Square, RefreshCw } from 'lucide-react'

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
  backtest_interval: { label: 'Backtest Interval', type: 'select', options: ['5m', '10m', '20m', '30m', '1h', '4h', '1d'] },
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

interface RiskSettings {
  max_portfolio_allocation: number
  max_position_allocation: number
  daily_loss_limit: number
  daily_profit_lock: number
  risk_mode: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [riskSettings, setRiskSettings] = useState<RiskSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [riskSaving, setRiskSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [riskSaved, setRiskSaved] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void; variant?: 'danger' | 'primary' } | null>(null)
  const { toast } = useToast()
  const { loading: valLoading, execute: valExec } = useAction()
  const { loading: rebalLoading, execute: rebalExec } = useAction()
  const { loading: promoLoading, execute: promoExec } = useAction()

  useEffect(() => {
    load()
    loadRisk()
  }, [])

  async function load() {
    try {
      const s = await api.get<Settings>('/api/settings')
      setSettings(s)
    } catch {}
  }

  async function loadRisk() {
    try {
      const r = await api.get<RiskSettings>('/api/risk/settings')
      setRiskSettings(r)
    } catch {}
  }

  async function saveRisk() {
    if (!riskSettings) return
    setRiskSaving(true)
    try {
      await api.post('/api/risk/settings', riskSettings)
      setRiskSaved(true)
      toast('success', 'Risk settings saved')
      setTimeout(() => setRiskSaved(false), 2000)
    } catch {
      toast('error', 'Failed to save risk settings')
    }
    setRiskSaving(false)
  }

  async function rebalance() {
    await rebalExec(
      () => api.post<{ message?: string }>('/api/portfolio/rebalance'),
      'Portfolio rebalanced',
    )
  }

  async function autoPromote() {
    await promoExec(
      () => api.post<{ message?: string; promoted?: number }>('/api/portfolio/auto-promote'),
      'Auto promote completed',
    )
  }

  async function toggleValidation(start: boolean) {
    const endpoint = start ? '/api/validation/start' : '/api/validation/stop'
    await valExec(
      () => api.post<{ message?: string }>(endpoint),
      start ? 'Validation started' : 'Validation stopped',
    )
  }

  function updateRisk(key: string, value: string | number) {
    if (!riskSettings) return
    setRiskSettings({ ...riskSettings, [key]: value })
  }

  async function save() {
    if (!settings) return
    setSaving(true)
    try {
      await api.post('/api/settings', settings)
      setSaved(true)
      toast('success', 'Settings saved')
      setTimeout(() => setSaved(false), 2000)
    } catch {
      toast('error', 'Failed to save settings')
    }
    setSaving(false)
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
      <div className="flex items-center gap-2 justify-end">
        {saved && <span className="text-[11px] text-green-400 font-medium">Saved!</span>}
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

      {/* Risk Settings */}
      <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
        <div className="p-3 border-b border-surface-border">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Risk Management</span>
          <button onClick={async () => { await loadRisk(); setRiskSaved(false) }}
            className="ml-2 p-1 text-text-muted hover:text-text transition-colors">
            <RotateCw size={12} />
          </button>
        </div>
        {riskSettings ? (
          <div className="divide-y divide-surface-border">
            <div className="px-4 py-3 flex items-center justify-between">
              <div><label className="text-sm text-text">Max Portfolio Allocation (Deployment %)</label></div>
              <input type="number" value={riskSettings.max_portfolio_allocation} min={0} max={100} step={5}
                onChange={(e) => updateRisk('max_portfolio_allocation', parseFloat(e.target.value) || 0)}
                className="w-20 bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border focus:outline-none focus:border-primary text-right" />
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <div><label className="text-sm text-text">Max Position Allocation (Max Exposure)</label></div>
              <input type="number" value={riskSettings.max_position_allocation} min={0} max={100} step={1}
                onChange={(e) => updateRisk('max_position_allocation', parseFloat(e.target.value) || 0)}
                className="w-20 bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border focus:outline-none focus:border-primary text-right" />
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <div><label className="text-sm text-text">Daily Loss Limit (%)</label></div>
              <input type="number" value={riskSettings.daily_loss_limit} min={0} max={20} step={0.5}
                onChange={(e) => updateRisk('daily_loss_limit', parseFloat(e.target.value) || 0)}
                className="w-20 bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border focus:outline-none focus:border-primary text-right" />
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <div><label className="text-sm text-text">Daily Profit Lock (%)</label></div>
              <input type="number" value={riskSettings.daily_profit_lock} min={0} max={50} step={1}
                onChange={(e) => updateRisk('daily_profit_lock', parseFloat(e.target.value) || 0)}
                className="w-20 bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border focus:outline-none focus:border-primary text-right" />
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <div><label className="text-sm text-text">Risk Mode</label></div>
              <select value={riskSettings.risk_mode} onChange={(e) => updateRisk('risk_mode', e.target.value)}
                className="bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border focus:outline-none focus:border-primary">
                <option value="conservative">Conservative</option>
                <option value="moderate">Moderate</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>
            <div className="px-4 py-3 flex items-center justify-end gap-2">
              {riskSaved && <span className="text-[11px] text-green-400 font-medium">Saved!</span>}
              <button onClick={saveRisk} disabled={riskSaving}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg disabled:opacity-50">
                <Save size={12} /> Save Risk
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-text-muted">Loading risk settings...</div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden p-4">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setConfirmAction({
            title: 'Rebalance Portfolio',
            message: 'Are you sure you want to rebalance the portfolio? This will adjust allocations.',
            variant: 'primary',
            onConfirm: rebalance,
          })}
            disabled={rebalLoading}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            <RefreshCw size={12} /> {rebalLoading ? 'Rebalancing...' : 'Rebalance Portfolio'}
          </button>

          <button onClick={() => setConfirmAction({
            title: 'Auto Promote',
            message: 'Auto-promote candidate strategies to the active portfolio?',
            variant: 'primary',
            onConfirm: autoPromote,
          })}
            disabled={promoLoading}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-surface-border text-text hover:bg-surface-hover transition-colors disabled:opacity-50">
            <Play size={12} /> {promoLoading ? 'Promoting...' : 'Auto Promote'}
          </button>

          <button onClick={() => setConfirmAction({
            title: 'Start Validation',
            message: 'Start 30-day paper trading validation?',
            variant: 'primary',
            onConfirm: () => toggleValidation(true),
          })}
            disabled={valLoading}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-green-500/15 text-green-400 font-medium hover:bg-green-500/25 transition-colors disabled:opacity-50">
            <Play size={12} /> {valLoading ? 'Starting...' : 'Start Validation'}
          </button>

          <button onClick={() => setConfirmAction({
            title: 'Stop Validation',
            message: 'Stop validation and generate report?',
            variant: 'danger',
            onConfirm: () => toggleValidation(false),
          })}
            disabled={valLoading}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-red-500/15 text-red-400 font-medium hover:bg-red-500/25 transition-colors disabled:opacity-50">
            <Square size={12} /> {valLoading ? 'Stopping...' : 'Stop Validation'}
          </button>
        </div>
      </div>

      {confirmAction && (
        <ConfirmDialog
          open={true}
          title={confirmAction.title}
          message={confirmAction.message}
          variant={confirmAction.variant}
          onConfirm={() => { confirmAction.onConfirm(); setConfirmAction(null) }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  )
}
