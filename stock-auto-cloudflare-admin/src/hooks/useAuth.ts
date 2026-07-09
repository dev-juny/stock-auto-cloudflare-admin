import { useState, useCallback, useEffect, useRef } from 'react'
import { api, setToken, clearToken, hasToken, LoginResponse, MeResponse } from '../utils/api'

export function useAuth() {
  const [isAuth, setIsAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    if (!hasToken()) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    api.get<MeResponse>('/api/auth/me', { signal: controller.signal })
      .then((d) => { if (mountedRef.current) setIsAuth(d.success) })
      .catch((e) => {
        if (e?.message === 'Request cancelled') return
        if (mountedRef.current) clearToken()
      })
      .finally(() => { if (mountedRef.current) setLoading(false) })
    return () => {
      mountedRef.current = false
      controller.abort()
    }
  }, [])

  const login = useCallback(async (username: string, password: string): Promise<string | null> => {
    const d = await api.post<LoginResponse>('/api/auth/login', { username, password })
    if (d.success && d.token) {
      setToken(d.token)
      setIsAuth(true)
      return null
    }
    return d.message || 'Login failed'
  }, [])

  const logout = useCallback(() => {
    clearToken()
    api.post('/api/auth/logout').catch(() => {})
    setIsAuth(false)
  }, [])

  return { isAuth, loading, login, logout }
}
