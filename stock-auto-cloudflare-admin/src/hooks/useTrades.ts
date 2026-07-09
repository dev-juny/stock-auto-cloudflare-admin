import { useCallback, useEffect, useRef } from 'react'
import { api, TradeEntry, hasToken } from '../utils/api'
import { useSafeAsync } from './useSafeAsync'

export function useTrades() {
  const fetcher = useCallback(async (signal: AbortSignal) => {
    if (!hasToken()) return [] as TradeEntry[]
    const list = await api.get<TradeEntry[]>('/api/backtest/trades?limit=50', { signal })
    return Array.isArray(list) ? list : []
  }, [])

  const { data, loading, refetch } = useSafeAsync(fetcher)

  return { trades: data ?? [], loading, refetch }
}
