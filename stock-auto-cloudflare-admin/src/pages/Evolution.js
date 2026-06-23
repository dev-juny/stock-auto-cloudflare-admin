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
import { GitCompare, CheckSquare, Info } from 'lucide-react';
export function EvolutionPage() {
    const [status, setStatus] = useState(null);
    const [strategies, setStrategies] = useState([]);
    const [generations, setGenerations] = useState([]);
    const [selectedStrategy, setSelectedStrategy] = useState(null);
    const [selectedGen, setSelectedGen] = useState(null);
    const [compareMode, setCompareMode] = useState(false);
    const [compareSelections, setCompareSelections] = useState(new Set());
    const [showCompare, setShowCompare] = useState(false);
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
    const toggleCompareMode = useCallback(() => {
        setCompareMode(prev => !prev);
        setCompareSelections(new Set());
        setShowCompare(false);
    }, []);
    const toggleCompareSelection = useCallback((gen) => {
        setCompareSelections(prev => {
            const next = new Set(prev);
            if (next.has(gen)) {
                next.delete(gen);
            }
            else {
                if (next.size >= 2)
                    return prev;
                next.add(gen);
            }
            return next;
        });
    }, []);
    const handleCompareClick = useCallback(() => {
        if (compareSelections.size === 2) {
            setShowCompare(true);
        }
    }, [compareSelections]);
    const sortedGens = [...generations].sort((a, b) => b.generation - a.generation);
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(EvolutionHeader, { status: status, onRun: handleRun, onRefresh: fetchData }), _jsx(LiveStatus, { status: status, generationCount: generations.length, strategyCount: strategies.length }), _jsxs("div", { className: "bg-surface rounded-xl p-3 flex items-start gap-2.5", children: [_jsx(Info, { size: 14, className: "text-primary mt-0.5 shrink-0" }), _jsxs("div", { className: "text-[11px] text-text-muted leading-relaxed", children: [_jsx("strong", { className: "text-text", children: "Strategy Parameter Optimization" }), " \u2014 Evolves entry/exit parameters (entry type, stop-loss, take-profit, trailing stop) on a shared evaluation universe.", _jsx("strong", { className: "text-text", children: " Stock selection evolution is not implemented." }), " All strategies in a generation are tested against the same random sample of 50 tickers."] })] }), _jsxs("div", { className: "flex items-center justify-between border-b border-surface-border pb-2", children: [_jsx("div", { className: "flex gap-2", children: ['strategies', 'timeline'].map((t) => (_jsx("button", { onClick: () => setTab(t), className: `px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${tab === t ? 'bg-primary text-white' : 'text-text-muted hover:text-text'}`, children: t === 'strategies' ? 'Strategy Pool' : 'Evolution Timeline' }, t))) }), tab === 'timeline' && (_jsxs("div", { className: "flex items-center gap-2", children: [compareMode && (_jsxs("button", { onClick: handleCompareClick, disabled: compareSelections.size !== 2, className: `flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${compareSelections.size === 2
                                    ? 'bg-primary text-white hover:bg-primary/90'
                                    : 'bg-surface text-text-muted cursor-not-allowed'}`, children: [_jsx(GitCompare, { size: 12 }), "Compare (", compareSelections.size, "/2)"] })), _jsxs("button", { onClick: toggleCompareMode, className: `flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${compareMode
                                    ? 'bg-primary/20 text-primary'
                                    : 'bg-surface text-text-muted hover:text-text'}`, children: [_jsx(CheckSquare, { size: 12 }), compareMode ? 'Cancel' : 'Select'] })] }))] }), tab === 'strategies' ? (_jsx(StrategyPool, { strategies: strategies, onSelect: setSelectedStrategy })) : (_jsxs("div", { className: "space-y-4", children: [_jsx(FitnessGraph, { generations: generations, onGenClick: handleGenClick }), _jsx(EvolutionTimeline, { generations: generations, onGenClick: handleGenClick, compareMode: compareMode, compareSelections: compareSelections, onToggleCompare: toggleCompareSelection })] })), selectedStrategy && (_jsx(StrategyDetail, { strategy: selectedStrategy, onClose: () => setSelectedStrategy(null) })), selectedGen !== null && !showCompare && (_jsx(GenerationDetail, { generation: selectedGen, onClose: () => setSelectedGen(null) })), showCompare && compareSelections.size === 2 && (_jsx(GenerationCompare, { genA: Math.min(...Array.from(compareSelections)), genB: Math.max(...Array.from(compareSelections)), onClose: () => {
                    setShowCompare(false);
                    setCompareMode(false);
                    setCompareSelections(new Set());
                } }))] }));
}
