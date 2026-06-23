import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../utils/api';
import { Search, Filter, ArrowUpDown, RefreshCw, ChevronLeft, ChevronRight, } from 'lucide-react';
const SORT_OPTIONS = [
    { label: 'Fitness', value: 'fitness_score' },
    { label: 'Return', value: 'total_return' },
    { label: 'Win Rate', value: 'win_rate' },
    { label: 'MDD', value: 'max_drawdown' },
    { label: 'Generation', value: 'generation' },
    { label: 'Name', value: 'name' },
];
export default function StrategiesPage() {
    const [data, setData] = useState(null);
    const [offset, setOffset] = useState(0);
    const [limit] = useState(20);
    const [sortBy, setSortBy] = useState('fitness_score');
    const [sortDir, setSortDir] = useState('desc');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [filters, setFilters] = useState({});
    const [showFilters, setShowFilters] = useState(false);
    const load = useCallback(async () => {
        try {
            const params = new URLSearchParams({
                offset: String(offset), limit: String(limit),
                sort_by: sortBy, sort_dir: sortDir,
                search, source: 'evolution',
            });
            if (filters.generation !== undefined)
                params.set('generation', String(filters.generation));
            if (filters.min_return !== undefined)
                params.set('min_return', String(filters.min_return));
            if (filters.max_return !== undefined)
                params.set('max_return', String(filters.max_return));
            if (filters.min_winrate !== undefined)
                params.set('min_winrate', String(filters.min_winrate));
            if (filters.max_winrate !== undefined)
                params.set('max_winrate', String(filters.max_winrate));
            if (filters.max_mdd !== undefined)
                params.set('max_mdd', String(filters.max_mdd));
            const res = await api.get(`/api/strategies?${params}`);
            setData(res);
        }
        catch { }
    }, [offset, limit, sortBy, sortDir, search, filters]);
    useEffect(() => { load(); }, [load]);
    const totalPages = data ? Math.ceil(data.total / limit) : 0;
    const currentPage = Math.floor(offset / limit) + 1;
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-bold text-text", children: "Strategies" }), _jsx("button", { onClick: load, className: "p-2 text-text-muted hover:text-text transition-colors", children: _jsx(RefreshCw, { size: 14 }) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("div", { className: "flex-1 relative", children: [_jsx(Search, { size: 12, className: "absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" }), _jsx("input", { value: searchInput, onChange: e => setSearchInput(e.target.value), onKeyDown: e => { if (e.key === 'Enter') {
                                    setSearch(searchInput);
                                    setOffset(0);
                                } }, placeholder: "Search by name, type, or ID...", className: "w-full bg-surface-card text-text text-xs pl-8 pr-3 py-2 rounded-lg border border-surface-border focus:outline-none focus:border-primary" })] }), _jsx("button", { onClick: () => setShowFilters(!showFilters), className: `p-2 rounded-lg border transition-colors ${showFilters ? 'bg-primary/10 border-primary text-primary' : 'border-surface-border text-text-muted hover:text-text'}`, children: _jsx(Filter, { size: 14 }) })] }), showFilters && (_jsxs("div", { className: "bg-surface-card rounded-xl border border-surface-border p-4", children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "text-[10px] text-text-muted block mb-1", children: "Min Return (%)" }), _jsx("input", { type: "number", value: filters.min_return ?? '', onChange: e => setFilters(f => ({ ...f, min_return: e.target.value ? parseFloat(e.target.value) : undefined })), className: "w-full bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-[10px] text-text-muted block mb-1", children: "Max Return (%)" }), _jsx("input", { type: "number", value: filters.max_return ?? '', onChange: e => setFilters(f => ({ ...f, max_return: e.target.value ? parseFloat(e.target.value) : undefined })), className: "w-full bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-[10px] text-text-muted block mb-1", children: "Max MDD (%)" }), _jsx("input", { type: "number", value: filters.max_mdd ?? '', onChange: e => setFilters(f => ({ ...f, max_mdd: e.target.value ? parseFloat(e.target.value) : undefined })), className: "w-full bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-[10px] text-text-muted block mb-1", children: "Generation" }), _jsx("input", { type: "number", value: filters.generation ?? '', onChange: e => setFilters(f => ({ ...f, generation: e.target.value ? parseInt(e.target.value) : undefined })), className: "w-full bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border" })] })] }), _jsxs("div", { className: "flex gap-2 mt-3", children: [_jsx("button", { onClick: () => { setFilters({}); setOffset(0); }, className: "text-[11px] px-3 py-1.5 rounded-lg border border-surface-border text-text-muted hover:text-text transition-colors", children: "Clear Filters" }), _jsx("button", { onClick: () => setOffset(0), className: "text-[11px] px-3 py-1.5 rounded-lg bg-primary text-white font-medium", children: "Apply" })] })] })), _jsx("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: !data?.items ? (_jsx("div", { className: "p-6 text-center text-xs text-text-muted", children: "Loading..." })) : data.items.length === 0 ? (_jsx("div", { className: "p-6 text-center text-xs text-text-muted", children: "No strategies found" })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-text-muted border-b border-surface-border", children: [_jsx("th", { className: "text-left px-3 py-2 font-medium", children: _jsxs("button", { onClick: () => { setSortBy('name'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }, className: "flex items-center gap-1 hover:text-text transition-colors", children: ["Name ", _jsx(ArrowUpDown, { size: 10 })] }) }), SORT_OPTIONS.map(o => (_jsx("th", { className: "text-right px-2 py-2 font-medium", children: _jsxs("button", { onClick: () => { setSortBy(o.value); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }, className: `flex items-center gap-1 ml-auto hover:text-text transition-colors ${sortBy === o.value ? 'text-primary' : ''}`, children: [o.label, " ", _jsx(ArrowUpDown, { size: 10 })] }) }, o.value))), _jsx("th", { className: "text-right px-2 py-2 font-medium", children: "Trades" })] }) }), _jsx("tbody", { className: "divide-y divide-surface-border", children: data.items.map(s => (_jsxs("tr", { className: "hover:bg-surface/50 transition-colors", children: [_jsx("td", { className: "px-3 py-2 text-text font-medium truncate max-w-[140px]", children: s.name }), _jsx("td", { className: "px-2 py-2 text-right text-amber-400", children: s.fitness_score.toFixed(2) }), _jsxs("td", { className: `px-2 py-2 text-right ${s.total_return >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [s.total_return >= 0 ? '+' : '', s.total_return.toFixed(2), "%"] }), _jsxs("td", { className: "px-2 py-2 text-right text-blue-400", children: [s.win_rate.toFixed(1), "%"] }), _jsxs("td", { className: "px-2 py-2 text-right text-red-400", children: [-s.max_drawdown.toFixed(2), "%"] }), _jsx("td", { className: "px-2 py-2 text-right text-text-muted", children: s.generation }), _jsx("td", { className: "px-2 py-2 text-right text-text-muted", children: s.total_trades })] }, s.id))) })] }) }), _jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-t border-surface-border", children: [_jsxs("span", { className: "text-[11px] text-text-muted", children: [data.total, " total \u00B7 Page ", currentPage, " of ", totalPages || 1] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { disabled: offset === 0, onClick: () => setOffset(o => Math.max(0, o - limit)), className: "p-1.5 rounded-lg disabled:opacity-30 text-text-muted hover:text-text transition-colors", children: _jsx(ChevronLeft, { size: 14 }) }), _jsx("button", { disabled: offset + limit >= data.total, onClick: () => setOffset(o => o + limit), className: "p-1.5 rounded-lg disabled:opacity-30 text-text-muted hover:text-text transition-colors", children: _jsx(ChevronRight, { size: 14 }) })] })] })] })) })] }));
}
