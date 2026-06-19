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
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
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
  elite_preserve_count: number
  evolution_enabled: boolean
  mdd_threshold: number
  winrate_threshold: number
  return_threshold: number
}

export interface EvolutionHolding {
  stock_code: string
  stock_name: string
  market: string
  weight: number
  entry_price: number
  current_price: number
  return_pct: number
  pnl_amount: number
  holding_days: number
  contribution_pct: number
  status: string
  factor_scores?: {
    momentum_score: number
    value_score: number
    quality_score: number
    volatility_score: number
    fitness_contribution: number
  } | null
  selection_reasons?: string[] | null
}

export interface EvolutionTrade {
  trade_date: string
  stock_code: string
  stock_name: string
  action: string
  quantity: number
  price: number
  amount: number
  reason: string
}

export interface ContributionEntry {
  stock_code: string
  stock_name: string
  contribution_pct: number
  return_pct: number
  weight_avg: number
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
  holdings: EvolutionHolding[]
  trades: EvolutionTrade[]
  contributions: ContributionEntry[]
}

export interface CompareStockAction {
  stock_code: string
  stock_name: string
  action: string
  weight_before: number
  weight_after: number
  return_before: number
  return_after: number
}

export interface HistoryCompareResult {
  gen_a: { generation: number; count: number; avg_return: number; avg_winrate: number; avg_fitness: number; avg_mdd: number }
  gen_b: { generation: number; count: number; avg_return: number; avg_winrate: number; avg_fitness: number; avg_mdd: number }
  new_stocks: CompareStockAction[]
  removed_stocks: CompareStockAction[]
  changed_stocks: CompareStockAction[]
  stock_changes: CompareStockAction[]
}

export interface ContributionResponse {
  generation: number
  total_return: number
  contributions: ContributionEntry[]
  total_abs: number
}
