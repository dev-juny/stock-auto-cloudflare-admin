import { useState, useCallback, useEffect } from 'react'
import { api, LogEntry, hasToken } from '../utils/api'
import { useSafeAsync } from './useSafeAsync'

export function useLogs() {
  const fetcher = useCallback(async (signal: AbortSignal) => {
    if (!hasToken()) return [] as LogEntry[]
    const list = await api.get<LogEntry[]>('/api/logs?limit=50', { signal })
    return Array.isArray(list) ? list : []
  }, [])

  const { data, loading, refetch } = useSafeAsync(fetcher)

  const deleteLog = useCallback(async (id: number) => {
    await api.delete(`/api/logs/${id}`)
    refetch()
  }, [refetch])

  return { logs: data ?? [], loading, refetch, deleteLog }
}
