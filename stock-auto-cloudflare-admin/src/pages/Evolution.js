import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../utils/api';
import { EvolutionHeader } from '../components/evolution/EvolutionHeader';
import { StrategyPool } from '../components/evolution/StrategyPool';
import { EvolutionTimeline } from '../components/evolution/EvolutionTimeline';
import { FitnessGraph } from '../components/evolution/FitnessGraph';
import { StrategyDetail } from '../components/evolution/StrategyDetail';
import { GenerationDetail } from '../components/evolution/GenerationDetail';
import { GenerationCompare } from '../components/evolution/GenerationCompare';
import { LiveStatus } from '../components/evolution/LiveStatus';
export function EvolutionPage() {
    const [status, setStatus] = useState(null);
    const [strategies, setStrategies] = useState([]);
    const [generations, setGenerations] = useState([]);
    const [selectedStrategy, setSelectedStrategy] = useState(null);
    const [selectedGen, setSelectedGen] = useState(null);
    const [compareGen, setCompareGen] = useState(null);
    const [tab, setTab] = useState('strategies');
    const fetchData = useCallback(async () => {
        try {
            const [st, stratList, gens] = await Promise.all([
                api.get('/api/evolution/status'),
                api.get('/api/evolution/strategies'),
                api.get('/api/evolution/generations'),
            ]);
            setStatus(st);
            setStrategies(stratList);
            setGenerations(gens);
        }
        catch { }
    }, []);
    const handleRun = useCallback(async () => {
        try {
            await api.post('/api/evolution/run');
            setTimeout(fetchData, 2000);
        }
        catch { }
    }, [fetchData]);
    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, [fetchData]);
    const handleGenClick = useCallback((gen) => {
        setSelectedGen(gen);
    }, []);
    const handleCompare = useCallback((gen) => {
        if (compareGen === null) {
            setCompareGen(gen);
        }
        else {
            setCompareGen(gen);
        }
    }, []);
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(EvolutionHeader, { status: status, onRun: handleRun, onRefresh: fetchData }), _jsx(LiveStatus, { status: status, generationCount: generations.length, strategyCount: strategies.length }), _jsx("div", { className: "flex gap-2 border-b border-surface-border pb-2", children: ['strategies', 'timeline'].map((t) => (_jsx("button", { onClick: () => setTab(t), className: `px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${tab === t ? 'bg-primary text-white' : 'text-text-muted hover:text-text'}`, children: t === 'strategies' ? 'Strategy Pool' : 'Evolution Timeline' }, t))) }), tab === 'strategies' ? (_jsx(StrategyPool, { strategies: strategies, onSelect: setSelectedStrategy })) : (_jsxs("div", { className: "space-y-4", children: [_jsx(FitnessGraph, { generations: generations, onGenClick: handleGenClick }), _jsx(EvolutionTimeline, { generations: generations, onGenClick: handleGenClick })] })), selectedStrategy && (_jsx(StrategyDetail, { strategy: selectedStrategy, onClose: () => setSelectedStrategy(null) })), selectedGen !== null && (_jsx(GenerationDetail, { generation: selectedGen, onClose: () => setSelectedGen(null), onCompare: handleCompare })), compareGen !== null && selectedGen !== null && compareGen !== selectedGen && (_jsx(GenerationCompare, { genA: Math.min(selectedGen, compareGen), genB: Math.max(selectedGen, compareGen), onClose: () => setCompareGen(null) }))] }));
}
