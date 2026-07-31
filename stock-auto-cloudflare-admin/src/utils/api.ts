const BASE = ''
const REQUEST_TIMEOUT = 30000
const MAX_RETRIES = 2

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

export interface RequestOptions {
  signal?: AbortSignal
  timeout?: number
  retries?: number
}

async function request<T>(
  path: string,
  opts: RequestInit = {},
  reqOpts: RequestOptions = {}
): Promise<T> {
  const timeout = reqOpts.timeout ?? REQUEST_TIMEOUT
  const maxRetries = reqOpts.retries ?? MAX_RETRIES

  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  if (opts.body && typeof opts.body === 'string') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const combinedSignal = reqOpts.signal
        ? combineAbortSignals(reqOpts.signal, controller.signal)
        : controller.signal

      const res = await fetch(`${BASE}${path}`, {
        ...opts,
        headers,
        credentials: 'include',
        signal: combinedSignal,
      })

      if (!res.ok) {
        let errorMsg = `HTTP ${res.status}`
        try {
          const body = await res.json()
          errorMsg = body?.detail?.[0]?.msg || body?.detail || errorMsg
        } catch {}
        throw new Error(errorMsg)
      }

      const body = await res.json()
      return body
    } catch (e: any) {
      lastError = e
      if (e.name === 'AbortError') {
        if (reqOpts.signal?.aborted) throw new Error('Request cancelled')
        throw new Error(`Request timed out after ${timeout}ms`)
      }
      if (attempt < maxRetries && isRetryable(e)) continue
      throw e
    } finally {
      clearTimeout(timeoutId)
    }
  }

  throw lastError || new Error('Request failed')
}

function isRetryable(err: Error): boolean {
  const msg = err.message || ''
  if (msg.includes('timed out')) return true
  if (msg.includes('Failed to fetch')) return true
  if (msg.includes('NetworkError')) return true
  if (msg.includes('429') || msg.includes('503') || msg.includes('502')) return true
  return false
}

function combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      return controller.signal
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}

export const api = {
  get: <T>(path: string, reqOpts?: RequestOptions) => request<T>(path, {}, reqOpts),
  post: <T>(path: string, body?: unknown, reqOpts?: RequestOptions) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }, reqOpts),
  patch: <T>(path: string, body?: unknown, reqOpts?: RequestOptions) =>
    request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }, reqOpts),
  delete: <T>(path: string, reqOpts?: RequestOptions) => request<T>(path, { method: 'DELETE' }, reqOpts),
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
  id: number
  log_type: string
  source: string
  message: string
  created_at: string
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
  name?: string
  entry_price: number
  current_price?: number
  quantity: number
  pnl_pct?: number
  profit_pct?: number
  pnl_amount?: number
  entered_at?: string
  holding_days?: number
  highest_price?: number
  is_break_even?: boolean
}

export interface StrategyParams {
  entry_type: string
  entry_trigger: string
  min_volume: number
  max_volatility: number
  fixed_take_profit_pct: number
  break_even_activation_pct: number
  trailing_activation_pct: number
  trailing_stop_pct: number
  stop_loss_pct: number
  stall_exit_days: number
  max_concurrent_positions: number
  ranking_candidate_limit: number
}

export interface StrategyIndicators {
  use_volume_filter: boolean
  use_volatility_filter: boolean
  use_momentum: boolean
  use_breakout: boolean
  use_pullback: boolean
  momentum_period: number
  breakout_period: number
  pullback_threshold: number
}

export interface EvolutionStrategy {
  id: number
  name: string
  generation: number
  version: number
  parent_id: number | null
  params: StrategyParams
  indicators: StrategyIndicators
  is_alive: boolean
  is_elite: boolean
  fitness_score: number
  total_return: number
  win_rate: number
  max_drawdown: number
  profit_factor: number
  total_trades: number
  tags: string[]
  created_at: string
  last_test_at: string | null
}

export interface FitnessScore {
  strategy_id: number
  generation: number
  total_return: number
  win_rate: number
  max_drawdown: number
  profit_factor: number
  total_trades: number
  fitness: number
  calculated_at: string
}

export interface GenerationSummary {
  generation: number
  population_size: number
  elite_count: number
  avg_fitness: number
  best_fitness: number
  avg_return: number
  avg_winrate: number
  avg_mdd: number
  mutation_count: number
  crossover_count: number
  created_at: string
  created_at_kst?: string
}

export interface EvolutionStatus {
  is_running: boolean
  current_generation: number
  total_generations: number
  status: string
  current_operation: string
  progress_pct: number
  last_run_at: string | null
  last_run_at_kst?: string | null
  next_scheduled_run: string | null
  next_scheduled_run_kst?: string | null
  active_strategies: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  offset: number
  limit: number
}

export interface RegistryStrategy {
  id: number
  strategy_id: number | null
  name: string
  entry_type: string
  generation: number
  version: number
  is_active: boolean
  is_elite: boolean
  allocation_pct: number
  total_return: number
  win_rate: number
  max_drawdown: number
  profit_factor: number
  total_trades: number
  fitness_score: number
  registered_at: string
}

export interface GenerationCompareResult {
  gen_a: { generation: number; count: number; avg_return: number; avg_winrate: number; avg_fitness: number; avg_mdd: number }
  gen_b: { generation: number; count: number; avg_return: number; avg_winrate: number; avg_fitness: number; avg_mdd: number }
  new_entries: number
  removed: number
  changed: Array<{ strategy_id: number; name: string; return_change: number; winrate_change: number; fitness_change: number }>
}

export interface EvolutionConfig {
  population_size: number
  elite_ratio: number
  mutation_rate: number
  crossover_rate: number
  tournament_size: number
  max_generations: number
  fitness_return_weight: number
  fitness_winrate_weight: number
  fitness_mdd_penalty: number
  min_generation_interval_hours: number
  evolution_enabled: boolean
  mdd_threshold: number
  winrate_threshold: number
  return_threshold: number
}

export interface EvaluationUniverseStock {
  ticker: string
  name: string
  market: string
  sample_order: number
  selection_source: string
}

export interface GenerationHistory {
  generation: number
  population_size: number
  elite_count: number
  avg_fitness: number
  best_fitness: number
  avg_return: number
  avg_winrate: number
  avg_mdd: number
  total_return: number
  evaluation_universe: EvaluationUniverseStock[]
}

export interface RiskCheckResult {
  risk_status: string
  blocked: boolean
  reasons: string[]
  warnings: string[]
  today_pnl_pct: number
  open_positions: number
  total_exposure: number
  exposure_pct: number
  available_exposure_pct: number
  cash_ratio: number
  single_asset_ratio: number
  highest_concentration_ticker: string
  consecutive_losses: number
  portfolio_mdd: number
  avg_unrealized_pnl: number
  max_capital_deployment: number
  min_cash_ratio: number
  max_exposure: number
  max_position_allocation: number
  risk_reject_count: number
  exposure_reject_count: number
  position_allocation_reject_count: number
  last_risk_reason: string
}

export interface PromotionEntry {
  id: number
  strategy_id: number
  strategy_name: string
  old_status?: string
  new_status?: string
  action?: string
  fitness?: number
  reason: string
  created_at: string
  promoted_at?: string
}

export interface PromotionHistoryResponse {
  items: PromotionEntry[]
  total: number
}

export interface ValidationStatus {
  id: number
  is_active: boolean
  started_at: string
  completed_at: string
  result: Record<string, any>
  today: {
    daily_return: number
    cumulative_return: number
    mdd: number
    win_rate: number
    total_trades: number
  }
}

export interface ValidationDashboard {
  active: boolean
  validation_id: number
  started_at: string
  completed_at: string
  progress: {
    elapsed_days: number
    remaining_days: number
    progress_pct: number
  }
  metrics: {
    cumulative_return: number
    cagr: number
    max_drawdown: number
    win_rate: number
    profit_factor: number
    pf_grade: string
    sharpe: number
    sortino: number
    total_trades: number
    open_positions: number
    avg_holding_days: number
    avg_trade_return: number
  }
  advanced_metrics: {
    alpha: number
    beta: number
    benchmark_return: number
    information_ratio: number
    rolling_sharpe_latest: number
    rolling_sharpe_max: number
    rolling_sharpe_min: number
    rolling_sortino_latest: number
    rolling_sortino_max: number
    rolling_win_rate_latest: number
    rolling_pf_latest: number
    rolling_mdd_latest: number
    rolling_sharpe_series: number[]
    rolling_sortino_series: number[]
    rolling_win_rate_series: number[]
    rolling_pf_series: number[]
    rolling_mdd_series: number[]
  }
  equity_curve: { date: string; equity: number }[]
  drawdown_curve: { date: string; drawdown: number }[]
  monthly_returns: { month: string; return: number }[]
  monthly_heatmap: Record<string, Record<string, number>>
  alpha_beta_trend: { month: string; alpha: number; beta: number }[]
  daily_logs: ValidationDailyLog[]
  readiness: string
  checks: Record<string, any>
  checks_passed: number
  checks_total: number
}

export interface ValidationDailyLog {
  date: string
  daily_return: number
  cumulative_return: number
  mdd: number
  win_rate: number
  total_trades: number
}

export interface ValidationReport {
  total_return: number
  benchmark_return: number
  alpha: number
  win_rate: number
  profit_factor: number
  sharpe: number
  mdd: number
  verdict: string
  reasons: string[]
}

export interface LiveTradingReadiness {
  ready: boolean
  checks: LiveTradingCheck[]
}

export interface LiveTradingCheck {
  name: string
  passed: boolean
  actual: number
  threshold: number
  detail: string
}

export interface RebalanceEntry {
  id: number
  method: string
  before: string
  after: string
  executed_at: string
}

export interface SystemHealth {
  database: string
  active_sessions: number
  cache_entries: number
  table_count: number
  uptime_hours: number
  status: string
}

export interface SchedulerStatus {
  apscheduler: { running: boolean; jobs: number }
  paper_trading: { running: boolean; running_since: string | null }
  evolution: { running: boolean; current_generation: number }
  total_active_strategies: number
}

export interface DashboardGeneration {
  current: number
  status: string
  last_run: string | null
  next_scheduled: string | null
  population: number
  latest_generation: number
}

export interface DashboardPortfolio {
  total_return: number
  mdd: number
  sharpe: number
  cagr: number
  profit_factor: number
  pf_grade: string
  approved_strategies: number
  latest_pf: number
  latest_mdd: number
}

export interface DashboardRisk {
  status: string
  blocked: boolean
  reasons: string[]
  warnings: string[]
  cash_ratio: number
  open_positions: number
  mdd: number
  exposure_pct: number
  available_exposure_pct: number
  max_capital_deployment: number
  risk_reject_count: number
  last_risk_reason: string
}

export interface DashboardPaperTrading {
  session_id: number
  session_name: string
  session_status: string
  initial_capital: number
  total_return: number
  total_pnl: number
  win_rate: number
  profit_factor: number
  pf_grade: string
  total_trades: number
  sell_trades: number
  open_positions: number
  cash_ratio: number
  exposure_pct: number
  first_trade: string
  last_sell_trade: string
}

export interface DashboardValidation {
  active: boolean
  started_at: string | null
  progress: Record<string, unknown>
  metrics: Record<string, unknown>
  advanced_metrics: Record<string, unknown>
  daily_logs: unknown[]
  monthly_heatmap: unknown
  alpha_beta_trend: unknown[]
}

export interface DashboardReadiness {
  score: number
  grade: string
  verdict: string
  passed: number
  total: number
  gaps: Record<string, unknown>
}

export interface DashboardSystem {
  exposure_pct: number
  cash_ratio_pct: number
  open_positions: number
  sell_trades: number
  risk_status: string
  validation_active: boolean
  validation_progress_pct: number
  readiness_score: number
}

export interface DashboardResponse {
  timestamp_kst: string
  generation: DashboardGeneration
  portfolio: DashboardPortfolio
  risk: DashboardRisk
  paper_trading: DashboardPaperTrading
  validation: DashboardValidation
  readiness: DashboardReadiness
  system: DashboardSystem
}

export interface HistoryCompareResult {
  gen_a: { generation: number; count: number; avg_return: number; avg_winrate: number; avg_fitness: number; avg_mdd: number }
  gen_b: { generation: number; count: number; avg_return: number; avg_winrate: number; avg_fitness: number; avg_mdd: number }
  universe?: {
    gen_a_count: number
    gen_b_count: number
    common_count: number
    added: EvaluationUniverseStock[]
    removed: EvaluationUniverseStock[]
  }
  strategy_changes?: Array<{ strategy_id: number; name: string; return_change: number; winrate_change: number; fitness_change: number }>
}
