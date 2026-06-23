import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Save, RotateCw } from 'lucide-react';
const settingMeta = {
    backtest_interval: { label: 'Backtest Interval', type: 'select', options: ['5m', '10m', '20m', '30m', '1h', '4h', '1d'] },
    evolution_enabled: { label: 'Auto Evolution', type: 'boolean' },
    population_size: { label: 'Population Size', type: 'number', min: 10, max: 200, step: 10 },
    mutation_rate: { label: 'Mutation Rate', type: 'number', min: 0, max: 1, step: 0.05 },
    crossover_rate: { label: 'Crossover Rate', type: 'number', min: 0, max: 1, step: 0.05 },
    elite_ratio: { label: 'Elite Ratio', type: 'number', min: 0.05, max: 0.5, step: 0.05 },
    tournament_size: { label: 'Tournament Size', type: 'number', min: 2, max: 20, step: 1 },
    max_generations: { label: 'Max Generations', type: 'number', min: 0, max: 500, step: 10, help: '0 = unlimited, 1+ = stop after N generations' },
    fitness_return_weight: { label: 'Fitness: Return Weight', type: 'number', min: 0, max: 1, step: 0.1 },
    fitness_winrate_weight: { label: 'Fitness: Win Rate Weight', type: 'number', min: 0, max: 1, step: 0.1 },
    fitness_mdd_penalty: { label: 'Fitness: MDD Penalty', type: 'number', min: 0, max: 1, step: 0.1 },
    mdd_threshold: { label: 'MDD Trigger (%)', type: 'number', min: 1, max: 50, step: 1 },
    winrate_threshold: { label: 'Win Rate Trigger (%)', type: 'number', min: 10, max: 90, step: 5 },
    return_threshold: { label: 'Return Trigger (%)', type: 'number', min: -50, max: 50, step: 5 },
};
export default function SettingsPage() {
    const [settings, setSettings] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    useEffect(() => {
        load();
    }, []);
    async function load() {
        try {
            const s = await api.get('/api/settings');
            setSettings(s);
        }
        catch { }
    }
    async function save() {
        if (!settings)
            return;
        setSaving(true);
        try {
            await api.post('/api/settings', settings);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
        catch { }
        setSaving(false);
    }
    function update(key, value) {
        if (!settings)
            return;
        setSettings({ ...settings, [key]: value });
    }
    if (!settings) {
        return _jsx("div", { className: "flex items-center justify-center h-48 text-xs text-text-muted", children: "Loading settings..." });
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-bold text-text", children: "Settings" }), _jsxs("div", { className: "flex items-center gap-2", children: [saved && _jsx("span", { className: "text-[11px] text-green-400 font-medium", children: "Saved!" }), _jsx("button", { onClick: () => { load(); setSaved(false); }, className: "p-2 text-text-muted hover:text-text transition-colors", children: _jsx(RotateCw, { size: 14 }) }), _jsxs("button", { onClick: save, disabled: saving, className: "flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg disabled:opacity-50", children: [_jsx(Save, { size: 12 }), "Save"] })] })] }), _jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsx("div", { className: "p-3 border-b border-surface-border", children: _jsx("span", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Evolution & Backtest" }) }), _jsx("div", { className: "divide-y divide-surface-border", children: Object.entries(settingMeta).map(([key, meta]) => (_jsxs("div", { className: "px-4 py-3 flex items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm text-text", children: meta.label }), meta.help && _jsx("p", { className: "text-[10px] text-text-muted mt-0.5", children: meta.help })] }), _jsx("div", { className: "shrink-0", children: meta.type === 'select' ? (_jsx("select", { value: String(settings[key]), onChange: (e) => update(key, e.target.value), className: "bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border focus:outline-none focus:border-primary min-w-[72px]", children: meta.options?.map(o => _jsx("option", { value: o, children: o }, o)) })) : meta.type === 'boolean' ? (_jsx("button", { onClick: () => update(key, !settings[key]), className: `w-10 h-5 rounded-full transition-colors relative ${settings[key] ? 'bg-primary' : 'bg-surface-border'}`, children: _jsx("div", { className: `w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${settings[key] ? 'translate-x-5' : 'translate-x-0.5'}` }) })) : (_jsx("input", { type: "number", value: Number(settings[key]), min: meta.min, max: meta.max, step: meta.step, onChange: (e) => update(key, parseFloat(e.target.value) || 0), className: "w-20 bg-surface text-text text-xs px-2 py-1.5 rounded-lg border border-surface-border focus:outline-none focus:border-primary text-right" })) })] }, key))) })] })] }));
}
