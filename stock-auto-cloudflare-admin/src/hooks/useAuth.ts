import { useState, useCallback, useEffect } from 'react'
import { api, setToken, clearToken, hasToken, LoginResponse, MeResponse } from '../utils/api'

export function useAuth() {
  const [isAuth, setIsAuth] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hasToken()) {
      setLoading(false)
      return
    }
    api.get<MeResponse>('/api/auth/me')
      .then((d) => setIsAuth(d.success))
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string): Promise<string | null> => {
    const d = await api.post<LoginResponse>('/api/auth/login', { username, password })
    if (d.success && d.token) {
      setToken(d.token)
      setIsAuth(true)
      return null
    }
    return d.message || '로그인 실패'
  }, [])

  const logout = useCallback(() => {
    clearToken()
    api.post('/api/auth/logout')
    setIsAuth(false)
  }, [])

  return { isAuth, loading, login, logout }
}
