import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Settings } from 'lucide-react'
import { Card } from '../common/Card'
import { CardSkeleton } from '../common/Skeleton'
import { Badge } from '../common/Badge'
import { api, ConfigEntry } from '../../utils/api'

export function StrategyCard() {
  const [config, setConfig] = useState<ConfigEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    api.get<ConfigEntry[]>('/api/backtest/configs')
      .then((list) => {
        const active = Array.isArray(list) ? list.find((c) => c.is_active) : null
        setConfig(active || null)
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
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-text-muted" />
          <h2 className="text-sm font-semibold text-text-primary">전략 설정</h2>
        </div>
        {config ? (
          <Badge variant="success">활성</Badge>
        ) : (
          <span className="text-xs text-text-muted">비활성</span>
        )}
      </button>

      {config && (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1.5">
            {renderStrategyTags(config.params)}
          </div>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary mt-2 transition-colors min-h-[36px]"
          >
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {open ? '접기' : '상세 보기'}
          </button>
          {open && (
            <div className="mt-2 p-3 bg-surface rounded-lg space-y-1.5">
              {renderStrategyDetails(config.params)}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function parseParams(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function renderStrategyTags(raw: string) {
  const p = parseParams(raw)
  const tags: string[] = []
  if (p.minVolume) tags.push(`Volume > ${Number(p.minVolume).toLocaleString()}`)
  if (p.maxVolatility && Number(p.maxVolatility) < 1) tags.push(`Volatility < ${(Number(p.maxVolatility) * 100).toFixed(0)}%`)
  if (p.fixedTakeProfitPct) tags.push(`TP ${(Number(p.fixedTakeProfitPct) * 100).toFixed(0)}%`)
  if (p.trailingStopPct) tags.push(`Trailing ${(Number(p.trailingStopPct) * 100).toFixed(0)}%`)
  if (p.entryType) tags.push(`Entry: ${p.entryType}`)
  if (p.stopLossPct && Number(p.stopLossPct) > 0) tags.push(`SL ${(Number(p.stopLossPct) * 100).toFixed(0)}%`)
  return tags.map((t) => (
    <span key={t} className="text-[11px] px-2 py-0.5 rounded-md bg-surface border border-surface-border text-text-secondary">
      {t}
    </span>
  ))
}

function renderStrategyDetails(raw: string) {
  const p = parseParams(raw)
  const rows: { label: string; value: string }[] = []
  const add = (label: string, val: unknown, fmt?: (v: unknown) => string) => {
    if (val !== undefined && val !== null && val !== '') {
      rows.push({ label, value: fmt ? fmt(val) : String(val) })
    }
  }
  add('매수 전략', p.entryType)
  add('매수 시점', p.entryTrigger)
  add('익절률', p.fixedTakeProfitPct, (v) => `${(Number(v) * 100).toFixed(0)}%`)
  add('본절 전환', p.breakEvenActivationPct, (v) => `${(Number(v) * 100).toFixed(0)}%`)
  add('트레일링 시작', p.trailingActivationPct, (v) => `${(Number(v) * 100).toFixed(0)}%`)
  add('트레일링 폭', p.trailingStopPct, (v) => `${(Number(v) * 100).toFixed(0)}%`)
  add('손절', p.stopLossPct, (v) => Number(v) > 0 ? `${(Number(v) * 100).toFixed(0)}%` : '없음')
  add('정체 청산', p.stallExitDays, (v) => `${v}일`)
  add('최대 포지션', p.maxConcurrentPositions)
  add('최소 거래량', p.minVolume, (v) => Number(v).toLocaleString())
  add('최대 변동성', p.maxVolatility, (v) => `${(Number(v) * 100).toFixed(0)}%`)

  return rows.map((r) => (
    <div key={r.label} className="flex items-center justify-between text-xs">
      <span className="text-text-muted">{r.label}</span>
      <span className="text-text-primary font-mono tabular-nums">{r.value}</span>
    </div>
  ))
}
