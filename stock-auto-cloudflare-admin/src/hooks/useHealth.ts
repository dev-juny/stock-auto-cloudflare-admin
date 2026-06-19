import { useState, useEffect, useRef } from 'react'
import { api, HealthResponse } from '../utils/api'

export interface SystemStatus {
  status: 'online' | 'offline' | 'warning'
  uptime: string
  db: string
}

export function useHealth() {
  const [status, setStatus] = useState<SystemStatus>({ status: 'offline', uptime: '-', db: '-' })
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  const fetch = () => {
    api.get<HealthResponse>('/api/health')
      .then((d) => {
        if (!mounted.current) return
        setStatus({
          status: d.status === 'ok' ? 'online' : 'warning',
          uptime: d.uptime ? formatUptimeSimple(d.uptime) : '-',
          db: d.db || '-',
        })
      })
      .catch(() => {
        if (mounted.current) setStatus((s) => ({ ...s, status: 'offline' }))
      })
      .finally(() => { if (mounted.current) setLoading(false) })
  }

  useEffect(() => {
    mounted.current = true
    fetch()
    const iv = setInterval(fetch, 30000)
    return () => { mounted.current = false; clearInterval(iv) }
  }, [])

  return { status, loading, refetch: fetch }
}

function formatUptimeSimple(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
