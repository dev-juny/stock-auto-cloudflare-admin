import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { Card } from '../components/common/Card'
import { CardSkeleton } from '../components/common/Skeleton'
import { Tooltip } from '../components/common/Tooltip'
import { useAction } from '../hooks/useAction'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import type { RiskCheckResult } from '../utils/api'
import { findGlossary } from '../utils/glossary'
import {
  Shield, ShieldAlert, AlertTriangle, CheckCircle, XCircle,
  TrendingUp, TrendingDown, DollarSign, Percent, Ban, Gauge,
  RefreshCw, Save,
} from 'lucide-react'

interface RiskSettings {
  max_portfolio_allocation: number
  max_position_allocation: number
  daily_loss_limit: number
  daily_profit_lock: number
  risk_mode: string
}

export default function RiskPage() {
  const [riskData, setRiskData] = useState<RiskCheckResult | null>(null)
  const [settings, setSettings] = useState<RiskSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editSettings, setEditSettings] = useState(false)
  const [deployPct, setDeployPct] = useState(100)
  const { loading: saving, execute: saveAction } = useAction()
  const { loading: deploying, execute: deployAction } = useAction()

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [risk, s] = await Promise.all([
        api.get<RiskCheckResult>('/api/risk/check'),
        api.get<RiskSettings>('/api/risk/settings'),
      ])
      setRiskData(risk)
      setSettings(s)
      setDeployPct(s.max_portfolio_allocation)
    } catch (e: any) {
      setError(e.message || 'Failed to load risk data')
    }
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  async function saveSettings() {
    if (!settings) return
    await saveAction(
      () => api.post('/api/risk/settings', settings),
      'Risk settings saved',
    )
    setEditSettings(false)
  }

  async function setDeployment() {
    await deployAction(
      () => api.post('/api/risk/set-deployment', { deployment_pct: deployPct }),
      `Deployment set to ${deployPct}%`,
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-5 w-24" />
        <div className="grid grid-cols-2 gap-3">{[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <XCircle size={24} className="text-red-400" />
        <p className="text-xs text-text-muted">{error}</p>
        <button onClick={loadAll} className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20">Retry</button>
      </div>
    )
  }

  const blocked = riskData?.blocked ?? false
  const reasons = riskData?.reasons ?? []

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={loadAll} className="p-2 text-text-muted hover:text-text">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Risk Status */}
      <Card className={blocked ? '!border-red-500/30' : ''}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {blocked ? <ShieldAlert size={18} className="text-red-400" /> : <Shield size={18} className="text-green-400" />}
            <span className="text-sm font-semibold text-text">Risk Status</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            blocked ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'
          }`}>
            {blocked ? 'BLOCKED' : riskData?.risk_status ?? 'N/A'}
          </span>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-surface rounded-xl p-3">
            <div className="flex items-center gap-1 text-text-muted mb-1">
              <Percent size={12} />
              <Tooltip content={findGlossary('exposure')?.description ?? 'Current Exposure'}>
                <span className="text-[10px]">Current Exposure</span>
              </Tooltip>
            </div>
            <div className={`text-sm font-bold font-mono tabular-nums ${(riskData?.total_exposure ?? 0) > 80 ? 'text-red-400' : 'text-text'}`}>
              {riskData?.total_exposure?.toFixed(1) ?? '-'}%
            </div>
          </div>
          <div className="bg-surface rounded-xl p-3">
            <div className="flex items-center gap-1 text-text-muted mb-1">
              <Gauge size={12} />
              <span className="text-[10px]">Max Exposure</span>
            </div>
            <div className="text-sm font-bold font-mono tabular-nums text-text">
              {settings?.max_portfolio_allocation ?? '-'}%
            </div>
          </div>
          <div className="bg-surface rounded-xl p-3">
            <div className="flex items-center gap-1 text-text-muted mb-1">
              <DollarSign size={12} />
              <Tooltip content={findGlossary('cashRatio')?.description ?? 'Cash Ratio'}>
                <span className="text-[10px]">Cash Ratio</span>
              </Tooltip>
            </div>
            <div className="text-sm font-bold font-mono tabular-nums text-blue-400">
              {riskData?.cash_ratio?.toFixed(1) ?? '-'}%
            </div>
          </div>
          <div className="bg-surface rounded-xl p-3">
            <div className="flex items-center gap-1 text-text-muted mb-1">
              <TrendingDown size={12} />
              <Tooltip content={findGlossary('mdd')?.description ?? 'MDD'}>
                <span className="text-[10px]">MDD</span>
              </Tooltip>
            </div>
            <div className={`text-sm font-bold font-mono tabular-nums ${(riskData?.portfolio_mdd ?? 0) > 20 ? 'text-red-400' : (riskData?.portfolio_mdd ?? 0) > 10 ? 'text-amber-400' : 'text-green-400'}`}>
              {riskData?.portfolio_mdd?.toFixed(1) ?? '-'}%
            </div>
          </div>
          <div className="bg-surface rounded-xl p-3">
            <div className="flex items-center gap-1 text-text-muted mb-1">
              <Ban size={12} />
              <Tooltip content={findGlossary('maxPositions')?.description ?? 'Position Count'}>
                <span className="text-[10px]">Position Count</span>
              </Tooltip>
            </div>
            <div className="text-sm font-bold font-mono tabular-nums text-text">
              {riskData?.open_positions ?? 0}
            </div>
          </div>
          <div className="bg-surface rounded-xl p-3">
            <div className="flex items-center gap-1 text-text-muted mb-1">
              <TrendingUp size={12} />
              <span className="text-[10px]">Largest Position</span>
            </div>
            <div className="text-sm font-bold font-mono tabular-nums text-text">
              {settings?.max_position_allocation ?? '-'}%
            </div>
          </div>
        </div>

        {/* Daily P&L */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <div className="bg-surface rounded-xl p-3">
            <div className="text-text-muted text-[10px]">Daily P&L</div>
            <div className={`font-bold font-mono tabular-nums ${(riskData?.today_pnl_pct ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(riskData?.today_pnl_pct ?? 0) >= 0 ? '+' : ''}{riskData?.today_pnl_pct?.toFixed(2) ?? '-'}%
            </div>
          </div>
          <div className="bg-surface rounded-xl p-3">
            <Tooltip content={findGlossary('stopLoss')?.description ?? 'Daily Loss Limit'}>
              <div className="text-text-muted text-[10px]">Daily Loss Limit</div>
            </Tooltip>
            <div className={`font-bold font-mono tabular-nums ${(riskData?.today_pnl_pct ?? 0) <= -(settings?.daily_loss_limit ?? 5) ? 'text-red-400' : 'text-green-400'}`}>
              {settings?.daily_loss_limit?.toFixed(1) ?? '-'}%
            </div>
          </div>
          <div className="bg-surface rounded-xl p-3">
            <Tooltip content={findGlossary('takeProfit')?.description ?? 'Profit Lock'}>
              <div className="text-text-muted text-[10px]">Profit Lock</div>
            </Tooltip>
            <div className={`font-bold font-mono tabular-nums ${(riskData?.today_pnl_pct ?? 0) >= (settings?.daily_profit_lock ?? 10) ? 'text-green-400' : 'text-text'}`}>
              {settings?.daily_profit_lock?.toFixed(1) ?? '-'}%
            </div>
          </div>
          <div className="bg-surface rounded-xl p-3">
            <Tooltip content={findGlossary('mdd')?.description ?? 'Max Drawdown Limit'}>
              <div className="text-text-muted text-[10px]">Max Drawdown Limit</div>
            </Tooltip>
            <div className="font-bold font-mono tabular-nums text-text">
              {riskData?.portfolio_mdd?.toFixed(1) ?? '-'}%
            </div>
          </div>
        </div>
      </Card>

      {/* BLOCKED Reasons */}
      {blocked && reasons.length > 0 && (
        <Card className="!border-red-500/30 !bg-red-500/5">
          <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle size={14} /> BLOCKED Reasons
          </h3>
          <div className="space-y-1.5">
            {reasons.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-red-400/80 bg-red-500/5 rounded-lg px-3 py-2 border border-red-500/10">
                <AlertTriangle size={12} />
                {r}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Risk Settings */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Risk Settings</h3>
          <button onClick={() => setEditSettings(!editSettings)}
            className="text-[10px] px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
            {editSettings ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {settings && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-surface rounded-xl p-3">
                <div className="text-text-muted text-[10px]">Max Portfolio Allocation</div>
                <div className="text-sm font-bold font-mono tabular-nums text-text">
                  {editSettings ? (
                    <input type="number" value={settings.max_portfolio_allocation} min={0} max={100} step={5}
                      onChange={e => setSettings({ ...settings, max_portfolio_allocation: parseFloat(e.target.value) || 0 })}
                      className="w-20 bg-surface-card text-text text-xs px-2 py-1 rounded-lg border border-surface-border focus:outline-none focus:border-primary" />
                  ) : `${settings.max_portfolio_allocation ?? '-'}%`}
                </div>
              </div>
              <div className="bg-surface rounded-xl p-3">
                <div className="text-text-muted text-[10px]">Max Position Allocation</div>
                <div className="text-sm font-bold font-mono tabular-nums text-text">
                  {editSettings ? (
                    <input type="number" value={settings.max_position_allocation} min={0} max={100} step={1}
                      onChange={e => setSettings({ ...settings, max_position_allocation: parseFloat(e.target.value) || 0 })}
                      className="w-20 bg-surface-card text-text text-xs px-2 py-1 rounded-lg border border-surface-border focus:outline-none focus:border-primary" />
                  ) : `${settings.max_position_allocation ?? '-'}%`}
                </div>
              </div>
              <div className="bg-surface rounded-xl p-3">
                <div className="text-text-muted text-[10px]">Daily Loss Limit</div>
                <div className="text-sm font-bold font-mono tabular-nums text-text">
                  {editSettings ? (
                    <input type="number" value={settings.daily_loss_limit} min={0} max={20} step={0.5}
                      onChange={e => setSettings({ ...settings, daily_loss_limit: parseFloat(e.target.value) || 0 })}
                      className="w-20 bg-surface-card text-text text-xs px-2 py-1 rounded-lg border border-surface-border focus:outline-none focus:border-primary" />
                  ) : `${settings.daily_loss_limit ?? '-'}%`}
                </div>
              </div>
              <div className="bg-surface rounded-xl p-3">
                <div className="text-text-muted text-[10px]">Profit Lock</div>
                <div className="text-sm font-bold font-mono tabular-nums text-text">
                  {editSettings ? (
                    <input type="number" value={settings.daily_profit_lock} min={0} max={50} step={1}
                      onChange={e => setSettings({ ...settings, daily_profit_lock: parseFloat(e.target.value) || 0 })}
                      className="w-20 bg-surface-card text-text text-xs px-2 py-1 rounded-lg border border-surface-border focus:outline-none focus:border-primary" />
                  ) : `${settings.daily_profit_lock ?? '-'}%`}
                </div>
              </div>
              <div className="bg-surface rounded-xl p-3">
                <div className="text-text-muted text-[10px]">Risk Mode</div>
                <div className="text-sm font-bold font-mono tabular-nums">
                  {editSettings ? (
                    <select value={settings.risk_mode}
                      onChange={e => setSettings({ ...settings, risk_mode: e.target.value })}
                      className="bg-surface-card text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border focus:outline-none focus:border-primary">
                      <option value="conservative">Conservative</option>
                      <option value="moderate">Moderate</option>
                      <option value="aggressive">Aggressive</option>
                    </select>
                  ) : (
                    <span className="text-xs capitalize">{settings.risk_mode}</span>
                  )}
                </div>
              </div>
            </div>

            {editSettings && (
              <button onClick={saveSettings} disabled={saving}
                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                <Save size={12} /> {saving ? 'Saving...' : 'Save Settings'}
              </button>
            )}
          </div>
        )}
      </Card>

      {/* Deployment Setter */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Capital Deployment</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-muted">Max Capital Deployment</span>
              <span className="text-xs font-mono tabular-nums text-primary">{deployPct}%</span>
            </div>
            <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${deployPct}%` }} />
            </div>
            <input type="range" min={0} max={100} step={5} value={deployPct}
              onChange={e => setDeployPct(parseInt(e.target.value))}
              className="w-full mt-2 accent-primary" />
          </div>
          <button onClick={setDeployment} disabled={deploying}
            className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0">
            {deploying ? '...' : 'Apply'}
          </button>
        </div>
      </Card>
    </div>
  )
}
