import { useState, FormEvent } from 'react'
import { Eye, EyeOff, Lock, User } from 'lucide-react'

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<string | null>
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const err = await onLogin(username, password)
    setLoading(false)
    if (err) setError(err)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-surface">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
            JJ
          </div>
          <h1 className="text-xl font-semibold text-text-primary">제이제이 연구소</h1>
          <p className="text-sm text-text-muted mt-1">자동매매 관리 시스템</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-text-muted block mb-1.5">아이디</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-surface-card border border-surface-border text-text-primary text-sm placeholder:text-text-muted/50"
                placeholder="admin"
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-text-muted block mb-1.5">비밀번호</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 pl-9 pr-10 rounded-xl bg-surface-card border border-surface-border text-text-primary text-sm placeholder:text-text-muted/50"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full h-11"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
