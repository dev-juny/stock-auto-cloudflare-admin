const BASE = ''

function getToken(): string {
  return sessionStorage.getItem('admin_token') || ''
}

export function setToken(t: string) {
  sessionStorage.setItem('admin_token', t)
}

export function clearToken() {
  sessionStorage.removeItem('admin_token')
}

export function hasToken(): boolean {
  return !!getToken()
}

async function request<T>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  if (opts.body && typeof opts.body === 'string') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  const res = await fetch(`${BASE}${path}`, { ...opts, headers, credentials: 'include' })
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export interface HealthResponse {
  status: string
  uptime?: number
  db?: string
  timestamp?: string
  service?: string
}

export interface LoginResponse {
  success: boolean
  token?: string
  message?: string
}

export interface MeResponse {
  success: boolean
  username?: string
}

export interface BalanceHolding {
  pdno: string
  prdt_name: string
  hldg_qty: string
  pchs_avg_pric: string
  prpr: string
  evlu_amt: string
  evlu_pfls_amt: string
  pfls_rt: string
  hldg_evlu_amt: string
}

export interface BalanceSummary {
  tot_evlu_amt: string
  tot_pft_amt: string
  tot_pft_rt: string
  prvs_rcdl_exc_amt: string
  dnca_tot_amt: string
}

export interface BalanceResponse {
  rt_cd: string
  msg1: string
  output: BalanceHolding[]
  output2: BalanceSummary[]
}

export interface LogEntry {
  LOG_ID: number
  LOG_LEVEL: string
  SOURCE: string
  MESSAGE: string
  CONTEXT: string | null
  CREATED_AT: string
}

export interface TradeEntry {
  id?: number
  ticker?: string
  name?: string
  action: string
  price: number
  quantity: number
  reason: string
  pnl?: number
  pnl_pct?: number
  traded_at: string
}

export interface ConfigEntry {
  id: number
  name: string
  params: string
  is_active: boolean
  created_at: string
}

export interface PositionEntry {
  ticker: string
  name: string
  entry_price: number
  current_price: number
  quantity: number
  pnl_pct: number
  pnl_amount: number
  entered_at: string
}
