import { useEffect, useState, useCallback } from 'react'
import { api, type EvolutionStatus, type EvolutionStrategy, type GenerationSummary } from '../utils/api'
import { EvolutionHeader } from '../components/evolution/EvolutionHeader'
import { StrategyPool } from '../components/evolution/StrategyPool'
import { EvolutionTimeline } from '../components/evolution/EvolutionTimeline'
import { FitnessGraph } from '../components/evolution/FitnessGraph'
import { StrategyDetail } from '../components/evolution/StrategyDetail'
import { GenerationDetail } from '../components/evolution/GenerationDetail'
import { GenerationCompare } from '../components/evolution/GenerationCompare'
import { LiveStatus } from '../components/evolution/LiveStatus'
import { GitCompare, CheckSquare, Info } from 'lucide-react'

export function EvolutionPage() {
  const [status, setStatus] = useState<EvolutionStatus | null>(null)
  const [strategies, setStrategies] = useState<EvolutionStrategy[]>([])
  const [generations, setGenerations] = useState<GenerationSummary[]>([])
  const [selectedStrategy, setSelectedStrategy] = useState<EvolutionStrategy | null>(null)
  const [selectedGen, setSelectedGen] = useState<number | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareSelections, setCompareSelections] = useState<Set<number>>(new Set())
  const [showCompare, setShowCompare] = useState(false)
  const [tab, setTab] = useState<'strategies' | 'timeline'>('strategies')

  const fetchData = useCallback(async () => {
    try {
      const [st, stratList, gens] = await Promise.all([
        api.get<EvolutionStatus>('/api/evolution/status'),
        api.get<any>('/api/evolution/strategies'),
        api.get<any>('/api/evolution/generations'),
      ])
      setStatus(st)
      setStrategies(Array.isArray(stratList) ? stratList : (stratList?.items ?? []))
      setGenerations(Array.isArray(gens) ? gens : (gens?.items ?? []))
    } catch {}
  }, [])

  const handleRun = useCallback(async () => {
    try {
      await api.post('/api/evolution/run')
      setTimeout(fetchData, 2000)
    } catch {}
  }, [fetchData])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleGenClick = useCallback((gen: number) => {
    setSelectedGen(gen)
  }, [])

  const toggleCompareMode = useCallback(() => {
    setCompareMode(prev => !prev)
    setCompareSelections(new Set())
    setShowCompare(false)
  }, [])

  const toggleCompareSelection = useCallback((gen: number) => {
    setCompareSelections(prev => {
      const next = new Set(prev)
      if (next.has(gen)) {
        next.delete(gen)
      } else {
        if (next.size >= 2) return prev
        next.add(gen)
      }
      return next
    })
  }, [])

  const handleCompareClick = useCallback(() => {
    if (compareSelections.size === 2) {
      setShowCompare(true)
    }
  }, [compareSelections])

  const sortedGens = [...generations].sort((a, b) => b.generation - a.generation)

  return (
    <div className="space-y-4">
      <EvolutionHeader status={status} onRun={handleRun} onRefresh={fetchData} />

      <LiveStatus
        status={status}
        generationCount={generations.length}
        strategyCount={strategies.length}
      />

      <div className="bg-surface rounded-xl p-3 flex items-start gap-2.5">
        <Info size={14} className="text-primary mt-0.5 shrink-0" />
        <div className="text-[11px] text-text-muted leading-relaxed">
          <strong className="text-text">Strategy Parameter Optimization</strong> — Evolves entry/exit parameters (entry type, stop-loss, take-profit, trailing stop) on a shared evaluation universe.
          <strong className="text-text"> Stock selection evolution is not implemented.</strong> All strategies in a generation are tested against the same random sample of 50 tickers.
        </div>
      </div>

      <div className="flex items-start sm:items-center justify-between border-b border-surface-border pb-2 gap-2">
        <div className="flex gap-2 flex-wrap">
          {(['strategies', 'timeline'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                tab === t ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
              }`}
            >
              {t === 'strategies' ? 'Strategy Pool' : 'Evolution Timeline'}
            </button>
          ))}
        </div>
        {tab === 'timeline' && (
          <div className="flex items-center gap-2">
            {compareMode && (
              <button
                onClick={handleCompareClick}
                disabled={compareSelections.size !== 2}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  compareSelections.size === 2
                    ? 'bg-primary text-white hover:bg-primary/90'
                    : 'bg-surface text-text-muted cursor-not-allowed'
                }`}
              >
                <GitCompare size={12} />
                Compare ({compareSelections.size}/2)
              </button>
            )}
            <button
              onClick={toggleCompareMode}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                compareMode
                  ? 'bg-primary/20 text-primary'
                  : 'bg-surface text-text-muted hover:text-text'
              }`}
            >
              <CheckSquare size={12} />
              {compareMode ? 'Cancel' : 'Select'}
            </button>
          </div>
        )}
      </div>

      {tab === 'strategies' ? (
        <StrategyPool
          strategies={strategies}
          onSelect={setSelectedStrategy}
        />
      ) : (
        <div className="space-y-4">
          <FitnessGraph generations={generations} onGenClick={handleGenClick} />
          <EvolutionTimeline
            generations={generations}
            onGenClick={handleGenClick}
            compareMode={compareMode}
            compareSelections={compareSelections}
            onToggleCompare={toggleCompareSelection}
          />
        </div>
      )}

      {selectedStrategy && (
        <StrategyDetail
          strategy={selectedStrategy}
          onClose={() => setSelectedStrategy(null)}
        />
      )}

      {selectedGen !== null && !showCompare && (
        <GenerationDetail
          generation={selectedGen}
          onClose={() => setSelectedGen(null)}
        />
      )}

      {showCompare && compareSelections.size === 2 && (
        <GenerationCompare
          genA={Math.min(...Array.from(compareSelections))}
          genB={Math.max(...Array.from(compareSelections))}
          onClose={() => {
            setShowCompare(false)
            setCompareMode(false)
            setCompareSelections(new Set())
          }}
        />
      )}
    </div>
  )
}
