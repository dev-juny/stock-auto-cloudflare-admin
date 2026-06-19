import { useEffect, useState, useCallback } from 'react'
import { api, type PaginatedResponse, type RegistryStrategy } from '../utils/api'
import {
  Search, Filter, ArrowUpDown, RefreshCw, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, ToggleLeft, Trash2,
} from 'lucide-react'

type SortField = 'generation' | 'win_rate' | 'total_return' | 'fitness_score' | 'max_drawdown' | 'name' | 'id'
type SortDir = 'asc' | 'desc'

interface Filters {
  is_active?: boolean
  generation?: number
  min_return?: number
  max_return?: number
  min_winrate?: number
  max_winrate?: number
  max_mdd?: number
}

const SORT_OPTIONS: { label: string; value: SortField }[] = [
  { label: 'Fitness', value: 'fitness_score' },
  { label: 'Return', value: 'total_return' },
  { label: 'Win Rate', value: 'win_rate' },
  { label: 'MDD', value: 'max_drawdown' },
  { label: 'Generation', value: 'generation' },
  { label: 'Name', value: 'name' },
]

export default function StrategiesPage() {
  const [data, setData] = useState<PaginatedResponse<RegistryStrategy> | null>(null)
  const [offset, setOffset] = useState(0)
  const [limit] = useState(20)
  const [sortBy, setSortBy] = useState<SortField>('fitness_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState<Filters>({})
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        offset: String(offset), limit: String(limit),
        sort_by: sortBy, sort_dir: sortDir,
        search,
      })
      if (filters.is_active !== undefined) params.set('is_active', String(filters.is_active))
      if (filters.generation !== undefined) params.set('generation', String(filters.generation))
      if (filters.min_return !== undefined) params.set('min_return', String(filters.min_return))
      if (filters.max_return !== undefined) params.set('max_return', String(filters.max_return))
      if (filters.min_winrate !== undefined) params.set('min_winrate', String(filters.min_winrate))
      if (filters.max_winrate !== undefined) params.set('max_winrate', String(filters.max_winrate))
      if (filters.max_mdd !== undefined) params.set('max_mdd', String(filters.max_mdd))
      const res = await api.get<PaginatedResponse<RegistryStrategy>>(`/api/strategies?${params}`)
      setData(res)
    } catch {}
  }, [offset, limit, sortBy, sortDir, search, filters])

  useEffect(() => { load() }, [load])

  const totalPages = data ? Math.ceil(data.total / limit) : 0
  const currentPage = Math.floor(offset / limit) + 1

  async function toggleActive(s: RegistryStrategy) {
    try {
      await api.patch(`/api/strategies/${s.id}`, { is_active: !s.is_active })
      load()
    } catch {}
  }

  async function deleteStrategy(id: number) {
    if (!confirm('Delete this strategy?')) return
    try {
      await api.delete(`/api/strategies/${id}`)
      load()
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">Strategies</h2>
        <button onClick={load} className="p-2 text-text-muted hover:text-text transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setOffset(0) } }}
            placeholder="Search by name, type, or ID..."
            className="w-full bg-surface-card text-text text-xs pl-8 pr-3 py-2 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
          />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-lg border transition-colors ${showFilters ? 'bg-primary/10 border-primary text-primary' : 'border-surface-border text-text-muted hover:text-text'}`}>
          <Filter size={14} />
        </button>
      </div>

      {showFilters && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Status</label>
              <select value={filters.is_active === undefined ? '' : String(filters.is_active)}
                onChange={e => setFilters(f => ({ ...f, is_active: e.target.value === '' ? undefined : e.target.value === 'true' }))}
                className="w-full bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border">
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Min Return (%)</label>
              <input type="number" value={filters.min_return ?? ''}
                onChange={e => setFilters(f => ({ ...f, min_return: e.target.value ? parseFloat(e.target.value) : undefined }))}
                className="w-full bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border" />
            </div>
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Max Return (%)</label>
              <input type="number" value={filters.max_return ?? ''}
                onChange={e => setFilters(f => ({ ...f, max_return: e.target.value ? parseFloat(e.target.value) : undefined }))}
                className="w-full bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border" />
            </div>
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Max MDD (%)</label>
              <input type="number" value={filters.max_mdd ?? ''}
                onChange={e => setFilters(f => ({ ...f, max_mdd: e.target.value ? parseFloat(e.target.value) : undefined }))}
                className="w-full bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => { setFilters({}); setOffset(0) }}
              className="text-[11px] px-3 py-1.5 rounded-lg border border-surface-border text-text-muted hover:text-text transition-colors">
              Clear Filters
            </button>
            <button onClick={() => setOffset(0)}
              className="text-[11px] px-3 py-1.5 rounded-lg bg-primary text-white font-medium">
              Apply
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
        {!data ? (
          <div className="p-6 text-center text-xs text-text-muted">Loading...</div>
        ) : data.items.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">No strategies found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-surface-border">
                    <th className="text-left px-3 py-2 font-medium">
                      <button onClick={() => { setSortBy('name'); setSortDir(d => d === 'asc' ? 'desc' : 'asc') }}
                        className="flex items-center gap-1 hover:text-text transition-colors">
                        Name <ArrowUpDown size={10} />
                      </button>
                    </th>
                    {SORT_OPTIONS.map(o => (
                      <th key={o.value} className="text-right px-2 py-2 font-medium">
                        <button onClick={() => { setSortBy(o.value); setSortDir(d => d === 'asc' ? 'desc' : 'asc') }}
                          className={`flex items-center gap-1 ml-auto hover:text-text transition-colors ${sortBy === o.value ? 'text-primary' : ''}`}>
                          {o.label} <ArrowUpDown size={10} />
                        </button>
                      </th>
                    ))}
                    <th className="text-right px-2 py-2 font-medium">Status</th>
                    <th className="w-16 px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {data.items.map(s => (
                    <tr key={s.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-3 py-2 text-text font-medium truncate max-w-[140px]">{s.name}</td>
                      <td className="px-2 py-2 text-right text-amber-400">{s.fitness_score.toFixed(2)}</td>
                      <td className={`px-2 py-2 text-right ${s.total_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {s.total_return >= 0 ? '+' : ''}{s.total_return.toFixed(2)}%
                      </td>
                      <td className="px-2 py-2 text-right text-blue-400">{s.win_rate.toFixed(1)}%</td>
                      <td className="px-2 py-2 text-right text-red-400">{-s.max_drawdown.toFixed(2)}%</td>
                      <td className="px-2 py-2 text-right text-text-muted">{s.generation}</td>
                      <td className="px-2 py-2 text-right">
                        <span className={`inline-flex items-center gap-1 ${s.is_active ? 'text-green-400' : 'text-red-400'}`}>
                          {s.is_active ? <CheckCircle size={10} /> : <XCircle size={10} />}
                          <span className="text-[10px]">{s.is_active ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => toggleActive(s)}
                            className="p-1 text-text-muted hover:text-text transition-colors" title="Toggle active">
                            <ToggleLeft size={12} />
                          </button>
                          <button onClick={() => deleteStrategy(s.id)}
                            className="p-1 text-text-muted hover:text-red-400 transition-colors" title="Delete">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-surface-border">
              <span className="text-[11px] text-text-muted">
                {data.total} total &middot; Page {currentPage} of {totalPages || 1}
              </span>
              <div className="flex items-center gap-1">
                <button disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - limit))}
                  className="p-1.5 rounded-lg disabled:opacity-30 text-text-muted hover:text-text transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <button disabled={offset + limit >= data.total} onClick={() => setOffset(o => o + limit)}
                  className="p-1.5 rounded-lg disabled:opacity-30 text-text-muted hover:text-text transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
