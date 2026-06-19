import { KPICards } from '../components/dashboard/KPICards'
import { SystemStatusCard } from '../components/dashboard/SystemStatusCard'
import { PortfolioCard } from '../components/dashboard/PortfolioCard'
import { StrategyCard } from '../components/dashboard/StrategyCard'
import { PositionsCard } from '../components/dashboard/PositionsCard'
import { TradeHistory } from '../components/dashboard/TradeHistory'
import { LogViewer } from '../components/dashboard/LogViewer'
import { useHealth } from '../hooks/useHealth'
import { useBalance } from '../hooks/useBalance'

export function Dashboard() {
  const { status: systemStatus, loading: healthLoading, refetch: refetchHealth } = useHealth()
  const { data: portfolio, loading: portfolioLoading } = useBalance()

  return (
    <div className="space-y-3 pb-24">
      <KPICards
        portfolio={portfolio}
        systemStatus={systemStatus}
        loading={portfolioLoading && healthLoading}
      />

      <SystemStatusCard
        status={systemStatus}
        loading={healthLoading}
        onRefresh={refetchHealth}
      />

      <PortfolioCard data={portfolio} loading={portfolioLoading} />

      <PositionsCard />

      <StrategyCard />

      <TradeHistory />

      <LogViewer />
    </div>
  )
}
