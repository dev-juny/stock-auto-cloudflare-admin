import { useState, useEffect, useRef, useCallback } from 'react'
import { api, TradeEntry, hasToken } from '../utils/api'

export function useTrades() {
  const [trades, setTrades] = useState<TradeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  const fetch = useCallback(() => {
    if (!hasToken()) {
      if (mounted.current) setLoading(false)
      return
    }
    api.get<TradeEntry[]>('/api/backtest/trades?limit=50')
      .then((list) => { if (mounted.current) setTrades(Array.isArray(list) ? list : []) })
      .catch(() => {})
      .finally(() => { if (mounted.current) setLoading(false) })
  }, [])

  useEffect(() => {
    mounted.current = true
    fetch()
    return () => { mounted.current = false }
  }, [fetch])

  return { trades, loading, refetch: fetch }
}
