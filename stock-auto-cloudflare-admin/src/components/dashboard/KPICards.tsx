import { TrendingUp, TrendingDown, BarChart3, Target, DollarSign } from 'lucide-react'
import { Card } from '../common/Card'
import { CardSkeleton } from '../common/Skeleton'
import { Tooltip } from '../common/Tooltip'
import { formatKRW, formatPct } from '../../utils/format'
import { DashboardResponse } from '../../utils/api'
import { findGlossary } from '../../utils/glossary'

interface KPICardsProps {
  dash: DashboardResponse | null
  loading: boolean
}

interface KpiItem {
  label: string
  value: string | number
  sub?: string
  icon: typeof TrendingUp
  positive?: boolean
  neutral?: boolean
}

export function KPICards({ dash, loading }: KPICardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {[1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)}
      </div>
    )
  }

  const port = dash?.portfolio
  const paper = dash?.paper_trading
  const risk = dash?.risk

  const totalReturn = port?.total_return ?? paper?.total_return ?? 0
  const mdd = port?.mdd ?? risk?.mdd ?? 0
  const winRate = paper?.win_rate ?? 0
  const profitFactor = paper?.profit_factor ?? 0
  const sharpe = port?.sharpe ?? 0
  const cagr = port?.cagr ?? 0

  const labelKeys: Record<string, string> = {
    'Total Return': 'return',
    'CAGR': 'cagr',
    'MDD': 'mdd',
    'Sharpe': 'sharpe',
    'Win Rate': 'winRate',
    'Profit Factor': 'profitFactor',
  }

  const kpis: KpiItem[] = [
    { label: 'Total Return', value: formatPct(totalReturn), sub: `PF Grade: ${port?.pf_grade ?? paper?.pf_grade ?? 'N/A'}`, icon: TrendingUp, positive: totalReturn >= 0 },
    { label: 'CAGR', value: cagr > 0 ? `${cagr.toFixed(1)}%` : '-', sub: '연환산 수익률', icon: TrendingUp, positive: cagr > 0 },
    { label: 'MDD', value: `${mdd.toFixed(1)}%`, sub: '최대 손실 구간', icon: TrendingDown, positive: mdd < 10 ? true : mdd < 20 ? undefined : false },
    { label: 'Sharpe', value: sharpe > 0 ? sharpe.toFixed(2) : '-', sub: '위험조정 수익률', icon: BarChart3, positive: sharpe >= 1 },
    { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, sub: `${paper?.total_trades ?? 0}건`, icon: Target, positive: winRate >= 50 },
    { label: 'Profit Factor', value: profitFactor === Infinity ? '∞' : profitFactor.toFixed(2), sub: '수익/손실 비율', icon: DollarSign, positive: profitFactor > 1.5, neutral: profitFactor === Infinity || profitFactor <= 1.5 },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        const isPositive = kpi.positive
        const g = findGlossary(labelKeys[kpi.label])
        return (
          <Card key={kpi.label} className="!p-3">
            <div className="flex items-center justify-between mb-1.5">
              {g ? (
                <Tooltip content={g.description} size={12}>
                  <span className="text-[10px] font-medium text-text-muted tracking-wide">{kpi.label}</span>
                </Tooltip>
              ) : (
                <span className="text-[10px] font-medium text-text-muted tracking-wide">{kpi.label}</span>
              )}
              <Icon size={13} className={isPositive ? 'text-success' : kpi.positive === false ? 'text-danger' : 'text-primary'} />
            </div>
            <div className={`kpi-value !text-lg leading-tight ${
              kpi.neutral ? 'text-text-primary' :
              isPositive ? 'text-success' : 'text-danger'
            }`}>
              {kpi.value}
            </div>
            {kpi.sub && <div className="text-[10px] text-text-muted mt-0.5">{kpi.sub}</div>}
          </Card>
        )
      })}
    </div>
  )
}
