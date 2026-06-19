import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Settings, Play, Square } from 'lucide-react'
import { Card } from '../common/Card'
import { CardSkeleton } from '../common/Skeleton'
import { Badge } from '../common/Badge'
import { api, ConfigEntry } from '../../utils/api'

interface StrategySummary {
  active: boolean
  name: string
  tags: string[]
  params: Record<string, unknown>
}

export function StrategyCard() {
  const [summary, setSummary] = useState<StrategySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    api.get<ConfigEntry[]>('/api/backtest/configs')
      .then((list) => {
        const arr = Array.isArray(list) ? list : []
        const active = arr.find((c) => c.is_active)
        if (active) {
          const p = parseParams(active.params)
          setSummary({
            active: true,
            name: active.name,
            tags: buildTags(p),
            params: p,
          })
        } else {
          setSummary(null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <CardSkeleton />

  return (
    <Card>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between min-h-[44px]"
      >
        <div className="flex items-center gap-2.5">
          <Settings size={16} className="text-text-muted" />
          <div className="text-left">
            <h2 className="text-sm font-semibold text-text-primary">전략 설정</h2>
            {summary && (
              <p className="text-[10px] text-text-muted mt-0.5">{summary.name}</p>
            )}
          </div>
        </div>
        {summary ? (
          <Badge variant="success">활성</Badge>
        ) : (
          <span className="text-xs text-text-muted">비활성</span>
        )}
      </button>

      {summary && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5">
            {summary.tags.map((t) => (
              <span
                key={t}
                className="text-[10px] px-2 py-1 rounded-lg bg-surface border border-surface-border text-text-secondary font-mono"
              >
                {t}
              </span>
            ))}
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary mt-2.5 transition-colors min-h-[36px]"
          >
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {open ? '파라미터 접기' : '파라미터 상세'}
          </button>

          {open && (
            <div className="mt-2 p-3 bg-surface rounded-xl border border-surface-border space-y-1.5">
              {renderParams(summary.params)}
            </div>
          )}
        </div>
      )}

      {!summary && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] px-2 py-1 rounded-lg bg-surface border border-surface-border text-text-muted">
              Volume {'>'} 500K
            </span>
            <span className="text-[10px] px-2 py-1 rounded-lg bg-surface border border-surface-border text-text-muted">
              Volatility {'<'} 12%
            </span>
            <span className="text-[10px] px-2 py-1 rounded-lg bg-surface border border-surface-border text-text-muted">
              TP 7%
            </span>
          </div>
          <button className="flex items-center gap-1.5 text-[11px] text-text-muted mt-2 min-h-[36px] transition-colors hover:text-text-primary">
            <Play size={12} /> 백테스트에서 전략 설정하기
          </button>
        </div>
      )}
    </Card>
  )
}

function parseParams(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw) }
  catch { return {} }
}

function buildTags(p: Record<string, unknown>): string[] {
  const t: string[] = []
  if (p.entryType) t.push(`${p.entryType}`)
  if (p.fixedTakeProfitPct) t.push(`TP ${(Number(p.fixedTakeProfitPct) * 100).toFixed(0)}%`)
  if (p.trailingStopPct) t.push(`TS ${(Number(p.trailingStopPct) * 100).toFixed(0)}%`)
  if (p.stopLossPct && Number(p.stopLossPct) > 0) t.push(`SL ${(Number(p.stopLossPct) * 100).toFixed(0)}%`)
  if (p.minVolume) t.push(`Vol ${Number(p.minVolume).toLocaleString()}`)
  if (p.maxVolatility && Number(p.maxVolatility) < 1) t.push(`Volat ${(Number(p.maxVolatility) * 100).toFixed(0)}%`)
  if (p.maxConcurrentPositions) t.push(`Max ${p.maxConcurrentPositions}`)
  if (p.stallExitDays) t.push(`Stall ${p.stallExitDays}d`)
  return t
}

function renderParams(p: Record<string, unknown>) {
  const rows: { label: string; value: string }[] = []
  const add = (label: string, val: unknown, fmt?: (v: unknown) => string) => {
    if (val !== undefined && val !== null && val !== '') {
      rows.push({ label, value: fmt ? fmt(val) : String(val) })
    }
  }
  add('Entry', p.entryType)
  add('Trigger', p.entryTrigger)
  add('Take Profit', p.fixedTakeProfitPct, (v) => `${(Number(v) * 100).toFixed(0)}%`)
  add('Break Even', p.breakEvenActivationPct, (v) => `${(Number(v) * 100).toFixed(0)}%`)
  add('Trailing Start', p.trailingActivationPct, (v) => `${(Number(v) * 100).toFixed(0)}%`)
  add('Trailing Stop', p.trailingStopPct, (v) => `${(Number(v) * 100).toFixed(0)}%`)
  add('Stop Loss', p.stopLossPct, (v) => Number(v) > 0 ? `${(Number(v) * 100).toFixed(0)}%` : '-')
  add('Stall Exit', p.stallExitDays, (v) => `${v}d`)
  add('Max Positions', p.maxConcurrentPositions)
  add('Min Volume', p.minVolume, (v) => Number(v).toLocaleString())
  add('Max Volatility', p.maxVolatility, (v) => `${(Number(v) * 100).toFixed(0)}%`)

  return rows.map((r) => (
    <div key={r.label} className="flex items-center justify-between py-1">
      <span className="text-[11px] text-text-muted">{r.label}</span>
      <span className="text-[11px] text-text-primary font-mono tabular-nums">{r.value}</span>
    </div>
  ))
}
