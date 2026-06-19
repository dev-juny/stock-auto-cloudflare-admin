import { useState, useEffect, useRef, useCallback } from 'react'
import { api, BalanceResponse, BalanceHolding, BalanceSummary } from '../utils/api'
import { hasToken } from '../utils/api'

export interface PortfolioData {
  totalAssets: number
  totalPnl: number
  totalPnlPct: number
  cash: number
  holdings: BalanceHolding[]
  summary: BalanceSummary | null
}

export function useBalance() {
  const [data, setData] = useState<PortfolioData | null>(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  const fetch = useCallback(() => {
    if (!hasToken()) {
      if (mounted.current) setLoading(false)
      return
    }
    api.get<BalanceResponse>('/api/balance')
      .then((d) => {
        if (!mounted.current) return
        if (d.rt_cd !== '0') {
          setData(null)
          return
        }
        const holdings = d.output || []
        const summary = (d.output2 && d.output2[0]) || null
        const totalEvlu = holdings.reduce((s, i) => s + Number(i.evlu_amt || 0), 0)
        const totalPnl = holdings.reduce((s, i) => s + Number(i.evlu_pfls_amt || 0), 0)
        const cash = summary ? Number(summary.prvs_rcdl_exc_amt || 0) : 0
        setData({
          totalAssets: totalEvlu + cash,
          totalPnl,
          totalPnlPct: totalEvlu > 0 ? (totalPnl / (totalEvlu - totalPnl)) * 100 : 0,
          cash,
          holdings,
          summary,
        })
      })
      .catch(() => { if (mounted.current) setData(null) })
      .finally(() => { if (mounted.current) setLoading(false) })
  }, [])

  useEffect(() => {
    mounted.current = true
    fetch()
    const iv = setInterval(fetch, 30000)
    return () => { mounted.current = false; clearInterval(iv) }
  }, [fetch])

  return { data, loading, refetch: fetch }
}
