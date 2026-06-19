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

export function EvolutionPage() {
  const [status, setStatus] = useState<EvolutionStatus | null>(null)
  const [strategies, setStrategies] = useState<EvolutionStrategy[]>([])
  const [generations, setGenerations] = useState<GenerationSummary[]>([])
  const [selectedStrategy, setSelectedStrategy] = useState<EvolutionStrategy | null>(null)
  const [selectedGen, setSelectedGen] = useState<number | null>(null)
  const [compareGen, setCompareGen] = useState<number | null>(null)
  const [tab, setTab] = useState<'strategies' | 'timeline'>('strategies')

  const fetchData = useCallback(async () => {
    try {
      const [st, stratList, gens] = await Promise.all([
        api.get<EvolutionStatus>('/api/evolution/status'),
        api.get<EvolutionStrategy[]>('/api/evolution/strategies'),
        api.get<GenerationSummary[]>('/api/evolution/generations'),
      ])
      setStatus(st)
      setStrategies(stratList)
      setGenerations(gens)
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

  const handleCompare = useCallback((gen: number) => {
    if (compareGen === null) {
      setCompareGen(gen)
    } else {
      setCompareGen(gen)
    }
  }, [])

  return (
    <div className="space-y-4">
      <EvolutionHeader status={status} onRun={handleRun} onRefresh={fetchData} />

      <LiveStatus
        status={status}
        generationCount={generations.length}
        strategyCount={strategies.length}
      />

      <div className="flex gap-2 border-b border-surface-border pb-2">
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

      {tab === 'strategies' ? (
        <StrategyPool
          strategies={strategies}
          onSelect={setSelectedStrategy}
        />
      ) : (
        <div className="space-y-4">
          <FitnessGraph generations={generations} onGenClick={handleGenClick} />
          <EvolutionTimeline generations={generations} onGenClick={handleGenClick} />
        </div>
      )}

      {selectedStrategy && (
        <StrategyDetail
          strategy={selectedStrategy}
          onClose={() => setSelectedStrategy(null)}
        />
      )}

      {selectedGen !== null && (
        <GenerationDetail
          generation={selectedGen}
          onClose={() => setSelectedGen(null)}
          onCompare={handleCompare}
        />
      )}

      {compareGen !== null && selectedGen !== null && compareGen !== selectedGen && (
        <GenerationCompare
          genA={Math.min(selectedGen, compareGen)}
          genB={Math.max(selectedGen, compareGen)}
          onClose={() => setCompareGen(null)}
        />
      )}
    </div>
  )
}
