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
  Shield, ShieldAlert, AlertTriangle, XCircle, Info,
  TrendingUp, TrendingDown, DollarSign, Percent, Ban, Gauge,
  ArrowUp, ArrowDown, RefreshCw, Save, BarChart3, Lock, Unlock,
} from 'lucide-react'

interface RiskSettings {
  max_portfolio_allocation: number
  max_position_allocation: number
  daily_loss_limit: number
  daily_profit_lock: number
  risk_mode: string
}

interface ScanSettings {
  max_strategies: number
  max_tickers_per_strategy: number
}

function barColor(pct: number) {
  if (pct > 80) return 'bg-red-500'
  if (pct > 60) return 'bg-amber-500'
  return 'bg-green-500'
}

function textColor(pct: number) {
  if (pct > 80) return 'text-red-400'
  if (pct > 60) return 'text-amber-400'
  return 'text-green-400'
}

function concentrationStatus(current: number, limit: number): { label: string; color: string; bg: string } {
  const ratio = limit > 0 ? current / limit : 0
  if (current <= limit * 0.8) return { label: 'NORMAL', color: 'text-green-400', bg: 'bg-green-500/15' }
  if (current <= limit) return { label: 'WARNING', color: 'text-amber-400', bg: 'bg-amber-500/15' }
  if (current <= limit * 3) return { label: 'BUY RESTRICTED', color: 'text-red-400', bg: 'bg-red-500/15' }
  return { label: 'HIGH CONCENTRATION', color: 'text-red-400', bg: 'bg-red-500/20' }
}

export default function RiskPage() {
  const [riskData, setRiskData] = useState<RiskCheckResult | null>(null)
  const [settings, setSettings] = useState<RiskSettings | null>(null)
  const [scanSettings, setScanSettings] = useState<ScanSettings | null>(null)
  const [initialCapital, setInitialCapital] = useState(10000000)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editSettings, setEditSettings] = useState(false)
  const [editScanSettings, setEditScanSettings] = useState(false)
  const { loading: saving, execute: saveAction } = useAction()
  const { loading: scanSaving, execute: saveScanAction } = useAction()

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [risk, s, sc, status] = await Promise.all([
        api.get<RiskCheckResult>('/api/risk/check'),
        api.get<RiskSettings>('/api/risk/settings'),
        api.get<ScanSettings>('/api/risk/scan-settings'),
        api.get<any>('/api/paper-trading/status?session_id=8'),
      ])
      setRiskData(risk)
      setSettings(s)
      setScanSettings(sc)
      setInitialCapital(status.initial_capital ?? 10000000)
    } catch (e: any) {
      setError(e.message || 'Failed to load risk data')
    }
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  async function saveSettings() {
    if (!settings) return
    const clean = Object.fromEntries(
      Object.entries(settings).map(([k, v]) => [k, v === '' ? 0 : v])
    )
    await saveAction(
      () => api.post('/api/risk/settings', clean),
      'Risk settings saved',
    )
    setEditSettings(false)
  }

  async function saveScanSettings() {
    if (!scanSettings) return
    const clean = Object.fromEntries(
      Object.entries(scanSettings).map(([k, v]) => [k, v === '' ? 0 : v])
    )
    await saveScanAction(
      () => api.post('/api/risk/scan-settings', clean),
      'Scan settings saved',
    )
    setEditScanSettings(false)
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

  const exposurePct = riskData?.exposure_pct ?? 0
  const totalExposure = riskData?.total_exposure ?? 0
  const maxDeployPct = riskData?.max_capital_deployment ?? settings?.max_portfolio_allocation ?? 0
  const maxExposureAmt = riskData?.max_exposure ?? 0
  const remainingCapacity = Math.max(0, maxExposureAmt - totalExposure)
  const exceededBy = blocked ? Math.max(0, totalExposure - maxExposureAmt) : 0

  const singleAssetRatio = riskData?.single_asset_ratio ?? 0
  const maxPosAlloc = riskData?.max_position_allocation ?? settings?.max_position_allocation ?? 10
  const highestTicker = riskData?.highest_concentration_ticker ?? ''
  const concStatus = concentrationStatus(singleAssetRatio, maxPosAlloc)
  const concExceeded = singleAssetRatio > maxPosAlloc
  const concProgress = Math.min(100, (singleAssetRatio / Math.max(maxPosAlloc, 1)) * 100)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={loadAll} className="p-2 text-text-muted hover:text-text">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ── Portfolio Exposure ────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className={blocked ? 'text-red-400' : 'text-primary'} />
            <span className="text-sm font-semibold text-text">Portfolio Exposure</span>
          </div>
          <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
            blocked ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'
          }`}>
            {blocked ? 'ALL BUY BLOCKED' : 'ACTIVE'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-surface rounded-xl p-3">
            <div className="text-[10px] text-text-muted/60">Current Exposure</div>
            <div className={`text-lg font-bold font-mono tabular-nums ${textColor(exposurePct)}`}>
              {exposurePct.toFixed(1)}%
            </div>
            <div className="text-[10px] text-text-muted/40 font-mono tabular-nums mt-0.5">
              ₩{totalExposure.toLocaleString()}
            </div>
          </div>
          <div className="bg-surface rounded-xl p-3">
            <div className="text-[10px] text-text-muted/60">Max Allowed</div>
            <div className="text-lg font-bold font-mono tabular-nums text-text">
              {maxDeployPct.toFixed(1)}%
            </div>
            <div className="text-[10px] text-text-muted/40 font-mono tabular-nums mt-0.5">
              ₩{maxExposureAmt.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div>
            <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
              <span>Exposure</span>
              <span className={`font-mono tabular-nums ${textColor(exposurePct)}`}>{exposurePct.toFixed(1)}%</span>
            </div>
            <div className="relative w-full h-3 bg-surface rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor(exposurePct)}`}
                style={{ width: `${Math.min(100, exposurePct)}%` }} />
              <div className="absolute top-0 w-0.5 h-full bg-white/40"
                style={{ left: `${Math.min(100, maxDeployPct)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
              <span>Allowed</span>
              <span className="font-mono tabular-nums text-text-muted">{maxDeployPct.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-blue-500/60 transition-all"
                style={{ width: `${Math.min(100, maxDeployPct)}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface rounded-xl p-3">
            <div className="flex items-center gap-1 text-[10px] text-text-muted/60 mb-1">
              <ArrowUp size={10} className={remainingCapacity > 0 ? 'text-green-400' : 'text-text-muted/40'} />
              <span>Remaining Capacity</span>
            </div>
            <div className={`text-sm font-bold font-mono tabular-nums ${remainingCapacity > 0 ? 'text-green-400' : 'text-text-muted/40'}`}>
              ₩{remainingCapacity.toLocaleString()}
            </div>
          </div>
          {blocked && (
            <div className="bg-surface rounded-xl p-3 !border-red-500/20 !border">
              <div className="flex items-center gap-1 text-[10px] text-red-400/60 mb-1">
                <ArrowDown size={10} />
                <span>Exceeded By</span>
              </div>
              <div className="text-sm font-bold font-mono tabular-nums text-red-400">
                ₩{exceededBy.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── Position Concentration ────────────────────────────── */}
      <Card className={concExceeded ? '!border-amber-500/30 !bg-amber-500/5' : ''}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gauge size={16} className={concExceeded ? 'text-amber-400' : 'text-primary'} />
            <span className="text-sm font-semibold text-text">Position Concentration</span>
          </div>
          <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${concStatus.bg} ${concStatus.color}`}>
            {concStatus.label}
          </span>
        </div>

        {highestTicker && (
          <div className="bg-surface rounded-xl p-3 mb-4">
            <div className="text-[10px] text-text-muted/60 mb-1">Highest Concentration</div>
            <div className="text-sm font-bold text-text">{highestTicker}</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-surface rounded-xl p-3">
            <div className="text-[10px] text-text-muted/60">Current Allocation</div>
            <div className={`text-lg font-bold font-mono tabular-nums ${concExceeded ? 'text-red-400' : 'text-green-400'}`}>
              {singleAssetRatio.toFixed(1)}%
            </div>
          </div>
          <div className="bg-surface rounded-xl p-3">
            <div className="text-[10px] text-text-muted/60">Maximum Allowed</div>
            <div className="text-lg font-bold font-mono tabular-nums text-text">
              {maxPosAlloc.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
            <span>Allocation vs Limit</span>
            <span className={`font-mono tabular-nums ${concExceeded ? 'text-red-400' : 'text-green-400'}`}>
              {singleAssetRatio.toFixed(1)}% / {maxPosAlloc.toFixed(1)}%
            </span>
          </div>
          <div className="relative w-full h-3 bg-surface rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${concExceeded ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${concProgress}%` }} />
            <div className="absolute top-0 w-0.5 h-full bg-white/40"
              style={{ left: '100%' }} />
          </div>
        </div>

        {concExceeded && (
          <div className="bg-surface rounded-xl p-3 !border-red-500/20 !border">
            <div className="flex items-center gap-1 text-[10px] text-red-400/60 mb-1">
              <ArrowDown size={10} />
              <span>Exceeded By</span>
            </div>
            <div className="text-sm font-bold font-mono tabular-nums text-red-400">
              {(singleAssetRatio - maxPosAlloc).toFixed(1)}%p
            </div>
          </div>
        )}

        <div className="mt-3 flex items-start gap-2 text-xs px-3 py-2.5 rounded-lg bg-surface">
          {concExceeded ? (
            <>
              <Lock size={14} className="shrink-0 mt-0.5 text-amber-400" />
              <div>
                <p className="font-medium text-amber-400">BUY RESTRICTED for {highestTicker}</p>
                <p className="text-text-muted mt-0.5">Position allocation ({singleAssetRatio.toFixed(1)}%) exceeds configured limit ({maxPosAlloc.toFixed(1)}%). New BUY orders for this asset will be rejected. SELL orders remain allowed.</p>
              </div>
            </>
          ) : (
            <>
              <Unlock size={14} className="shrink-0 mt-0.5 text-green-400" />
              <div>
                <p className="font-medium text-green-400">Position allocation within limits</p>
                <p className="text-text-muted mt-0.5">Current allocation ({singleAssetRatio.toFixed(1)}%) is within the configured limit ({maxPosAlloc.toFixed(1)}%).</p>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* ── Risk Status & Order-Level Restrictions ────────────── */}
      <Card className={blocked ? '!border-red-500/30 !bg-red-500/5' : ''}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {blocked ? (
              <ShieldAlert size={18} className="text-red-400" />
            ) : (
              <Shield size={18} className="text-green-400" />
            )}
            <span className="text-sm font-semibold text-text">Risk Status</span>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            blocked ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'
          }`}>
            {blocked ? 'BLOCKED' : riskData?.risk_status ?? 'OK'}
          </span>
        </div>

        <div className="space-y-2">
          {blocked ? (
            <div className="flex items-start gap-2 text-xs text-red-400/80 bg-red-500/8 rounded-lg px-3 py-2.5">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-400">All BUY Blocked</p>
                <p className="text-red-400/60 mt-0.5">Exposure ({exposurePct.toFixed(1)}%) exceeds configured limit ({maxDeployPct.toFixed(1)}%). New buy orders are restricted across all assets until exposure decreases.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-xs text-green-400/80 bg-green-500/8 rounded-lg px-3 py-2.5">
              <Shield size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-400">Portfolio Risk: PASS</p>
                <p className="text-green-400/60 mt-0.5">Portfolio is within configured risk limits. Individual orders may still be restricted by position concentration limits.</p>
              </div>
            </div>
          )}

          {!blocked && concExceeded && (
            <div className="flex items-start gap-2 text-xs text-amber-400/80 bg-amber-500/8 rounded-lg px-3 py-2.5">
              <Lock size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-400">Order-Level Restriction Active</p>
                <p className="text-amber-400/60 mt-0.5">{highestTicker} BUY rejected: {singleAssetRatio.toFixed(1)}% {'>'} {maxPosAlloc.toFixed(1)}% position allocation limit. Other assets remain tradeable.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-surface rounded-lg p-2">
              <div className="text-[9px] text-text-muted/60">Exposure</div>
              <div className={`text-xs font-mono tabular-nums ${textColor(exposurePct)}`}>{exposurePct.toFixed(1)}%</div>
            </div>
            <div className="bg-surface rounded-lg p-2">
              <div className="text-[9px] text-text-muted/60">Allowed</div>
              <div className="text-xs font-mono tabular-nums text-text">{maxDeployPct.toFixed(1)}%</div>
            </div>
            <div className="bg-surface rounded-lg p-2">
              <div className="text-[9px] text-text-muted/60">Positions</div>
              <div className="text-xs font-mono tabular-nums text-amber-400">{riskData?.open_positions ?? 0}</div>
            </div>
            <div className="bg-surface rounded-lg p-2">
              <div className="text-[9px] text-text-muted/60">Cash Ratio</div>
              <div className="text-xs font-mono tabular-nums text-blue-400">{riskData?.cash_ratio?.toFixed(1) ?? '-'}%</div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Today's Risk Rejections ────────────────────────────── */}
      {(riskData?.risk_reject_count ?? 0) > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Ban size={14} className="text-red-400" />
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Today's Risk Rejections</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface rounded-xl p-3">
              <div className="text-[10px] text-text-muted/60">Total Rejected</div>
              <div className="text-sm font-bold font-mono tabular-nums text-red-400">{riskData?.risk_reject_count ?? 0}</div>
            </div>
            <div className="bg-surface rounded-xl p-3">
              <div className="text-[10px] text-text-muted/60">Exposure Limit</div>
              <div className="text-sm font-bold font-mono tabular-nums text-amber-400">{riskData?.exposure_reject_count ?? 0}</div>
            </div>
            <div className="bg-surface rounded-xl p-3">
              <div className="text-[10px] text-text-muted/60">Position Allocation</div>
              <div className="text-sm font-bold font-mono tabular-nums text-amber-400">{riskData?.position_allocation_reject_count ?? 0}</div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Daily P&L ─────────────────────────────────────────── */}
      <Card>
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Daily P&L</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-surface rounded-xl p-3">
            <div className="text-text-muted text-[10px]">Today</div>
            <div className={`font-bold font-mono tabular-nums ${(riskData?.today_pnl_pct ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(riskData?.today_pnl_pct ?? 0) >= 0 ? '+' : ''}{riskData?.today_pnl_pct?.toFixed(2) ?? '-'}%
            </div>
          </div>
          <div className="bg-surface rounded-xl p-3">
            <Tooltip content={'일일 손실 한도 도달 시 신규 매수 차단'}>
              <div className="text-text-muted text-[10px]">Loss Limit</div>
            </Tooltip>
            <div className={`font-bold font-mono tabular-nums ${(riskData?.today_pnl_pct ?? 0) <= -(settings?.daily_loss_limit ?? 5) ? 'text-red-400' : 'text-green-400'}`}>
              {settings?.daily_loss_limit?.toFixed(1) ?? '-'}%
            </div>
          </div>
          <div className="bg-surface rounded-xl p-3">
            <Tooltip content={'목표 수익 달성 시 수익 보호 정책'}>
              <div className="text-text-muted text-[10px]">Profit Lock</div>
            </Tooltip>
            <div className={`font-bold font-mono tabular-nums ${(riskData?.today_pnl_pct ?? 0) >= (settings?.daily_profit_lock ?? 10) ? 'text-green-400' : 'text-text'}`}>
              {settings?.daily_profit_lock?.toFixed(1) ?? '-'}%
            </div>
          </div>
          <div className="bg-surface rounded-xl p-3">
            <Tooltip content={'최대 낙폭 (Max Drawdown) — 포트폴리오 고점 대비 하락률'}>
              <div className="text-text-muted text-[10px]">MDD</div>
            </Tooltip>
            <div className={`font-bold font-mono tabular-nums ${(riskData?.portfolio_mdd ?? 0) > 20 ? 'text-red-400' : (riskData?.portfolio_mdd ?? 0) > 10 ? 'text-amber-400' : 'text-green-400'}`}>
              {riskData?.portfolio_mdd?.toFixed(1) ?? '-'}%
            </div>
          </div>
        </div>
      </Card>

      {/* ── Risk Settings ─────────────────────────────────────── */}
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
                <Tooltip content={'포트폴리오 전체 투자 가능 비율. 예: 80% = 1,000만 원 중 최대 800만 원 투자 가능'}>
                  <div className="flex items-center gap-1 text-text-muted text-[10px]">
                    Max Portfolio Allocation <Info size={10} />
                  </div>
                </Tooltip>
                <div className="text-sm font-bold font-mono tabular-nums text-text">
                  {editSettings ? (
                    <input type="number" value={settings.max_portfolio_allocation} min={0} max={100} step={5}
                      onChange={e => { const r = e.target.value; setSettings({ ...settings, max_portfolio_allocation: r === '' ? ('' as any) : (parseFloat(r) || 0) }) }}
                      className="w-20 bg-surface-card text-text text-xs px-2 py-1 rounded-lg border border-surface-border focus:outline-none focus:border-primary" />
                  ) : `${settings.max_portfolio_allocation ?? '-'}%`}
                </div>
              </div>
              <div className="bg-surface rounded-xl p-3">
                <Tooltip content={'단일 종목 최대 투자 비율. 예: 10% = 전체 포트폴리오의 10%까지 한 종목에 배분'}>
                  <div className="flex items-center gap-1 text-text-muted text-[10px]">
                    Max Position Allocation <Info size={10} />
                  </div>
                </Tooltip>
                <div className="text-sm font-bold font-mono tabular-nums text-text">
                  {editSettings ? (
                    <input type="number" value={settings.max_position_allocation} min={0} max={100} step={1}
                      onChange={e => { const r = e.target.value; setSettings({ ...settings, max_position_allocation: r === '' ? ('' as any) : (parseFloat(r) || 0) }) }}
                      className="w-20 bg-surface-card text-text text-xs px-2 py-1 rounded-lg border border-surface-border focus:outline-none focus:border-primary" />
                  ) : `${settings.max_position_allocation ?? '-'}%`}
                </div>
              </div>
              <div className="bg-surface rounded-xl p-3">
                <Tooltip content={'일일 손실 한도 도달 시 신규 매수 차단. 당일 손실이 이 값을 초과하면 더 이상 매수할 수 없음'}>
                  <div className="flex items-center gap-1 text-text-muted text-[10px]">
                    Daily Loss Limit <Info size={10} />
                  </div>
                </Tooltip>
                <div className="text-sm font-bold font-mono tabular-nums text-text">
                  {editSettings ? (
                    <input type="number" value={settings.daily_loss_limit} min={0} max={20} step={0.5}
                      onChange={e => { const r = e.target.value; setSettings({ ...settings, daily_loss_limit: r === '' ? ('' as any) : (parseFloat(r) || 0) }) }}
                      className="w-20 bg-surface-card text-text text-xs px-2 py-1 rounded-lg border border-surface-border focus:outline-none focus:border-primary" />
                  ) : `${settings.daily_loss_limit ?? '-'}%`}
                </div>
              </div>
              <div className="bg-surface rounded-xl p-3">
                <Tooltip content={'목표 수익률 달성 시 수익 보호 정책. 당일 수익이 이 값을 초과하면 추가 매수 제한'}>
                  <div className="flex items-center gap-1 text-text-muted text-[10px]">
                    Profit Lock <Info size={10} />
                  </div>
                </Tooltip>
                <div className="text-sm font-bold font-mono tabular-nums text-text">
                  {editSettings ? (
                    <input type="number" value={settings.daily_profit_lock} min={0} max={50} step={1}
                      onChange={e => { const r = e.target.value; setSettings({ ...settings, daily_profit_lock: r === '' ? ('' as any) : (parseFloat(r) || 0) }) }}
                      className="w-20 bg-surface-card text-text text-xs px-2 py-1 rounded-lg border border-surface-border focus:outline-none focus:border-primary" />
                  ) : `${settings.daily_profit_lock ?? '-'}%`}
                </div>
              </div>
              <div className="bg-surface rounded-xl p-3">
                <Tooltip content={'리스크 관리 모드. Conservative = 보수적, Moderate = 중간, Aggressive = 공격적'}>
                  <div className="flex items-center gap-1 text-text-muted text-[10px]">
                    Risk Mode <Info size={10} />
                  </div>
                </Tooltip>
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

      {/* ── Scan Settings ─────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Scan Settings</h3>
          <button onClick={() => setEditScanSettings(!editScanSettings)}
            className="text-[10px] px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
            {editScanSettings ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {scanSettings && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface rounded-xl p-3">
                <div className="text-text-muted text-[10px]">Max Strategies</div>
                <div className="text-text-muted/50 text-[9px] mt-0.5 leading-tight">스캔에 사용할 최대 전략 수 (scan_summary.strategies_scanned)</div>
                <div className="text-sm font-bold font-mono tabular-nums text-text mt-1">
                  {editScanSettings ? (
                    <input type="number" value={scanSettings.max_strategies} min={1} max={20} step={1}
                      onChange={e => { const r = e.target.value; setScanSettings({ ...scanSettings, max_strategies: r === '' ? ('' as any) : (parseInt(r) || 0) }) }}
                      className="w-20 bg-surface-card text-text text-xs px-2 py-1 rounded-lg border border-surface-border focus:outline-none focus:border-primary" />
                  ) : scanSettings.max_strategies}
                </div>
              </div>
              <div className="bg-surface rounded-xl p-3">
                <div className="text-text-muted text-[10px]">Max Tickers Per Strategy</div>
                <div className="text-text-muted/50 text-[9px] mt-0.5 leading-tight">전략당 검토할 최대 종목 수 (scan_summary.universe_total)</div>
                <div className="text-sm font-bold font-mono tabular-nums text-text mt-1">
                  {editScanSettings ? (
                    <input type="number" value={scanSettings.max_tickers_per_strategy} min={1} max={50} step={1}
                      onChange={e => { const r = e.target.value; setScanSettings({ ...scanSettings, max_tickers_per_strategy: r === '' ? ('' as any) : (parseInt(r) || 0) }) }}
                      className="w-20 bg-surface-card text-text text-xs px-2 py-1 rounded-lg border border-surface-border focus:outline-none focus:border-primary" />
                  ) : scanSettings.max_tickers_per_strategy}
                </div>
              </div>
            </div>

            {editScanSettings && (
              <button onClick={saveScanSettings} disabled={scanSaving}
                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                <Save size={12} /> {scanSaving ? 'Saving...' : 'Save Scan Settings'}
              </button>
            )}
          </div>
        )}
      </Card>

    </div>
  )
}
