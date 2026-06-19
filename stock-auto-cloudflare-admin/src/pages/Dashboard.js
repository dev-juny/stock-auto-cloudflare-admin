import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Settings, Activity, BarChart3, GitBranch, Repeat, ToggleLeft, Timer } from 'lucide-react';
export function Dashboard() {
    const [config, setConfig] = useState(null);
    const [sysStatus, setSysStatus] = useState(null);
    useEffect(() => {
        load();
        const interval = setInterval(load, 30000);
        return () => clearInterval(interval);
    }, []);
    async function load() {
        try {
            const [cfg, status] = await Promise.all([
                api.get('/api/evolution/config'),
                api.get('/api/system/status'),
            ]);
            setConfig(cfg);
            setSysStatus(status);
        }
        catch { }
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsx("h2", { className: "text-lg font-bold text-text", children: "Dashboard" }), sysStatus && (_jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border p-4", children: [_jsxs("div", { className: "flex items-center gap-1.5 mb-3", children: [_jsx(Activity, { size: 14, className: "text-primary" }), _jsx("span", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "System Status" })] }), _jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [_jsx(StatusItem, { label: "Database", value: sysStatus.db_connected ? 'Connected' : 'Disconnected', color: sysStatus.db_connected ? 'text-green-400' : 'text-red-400' }), _jsx(StatusItem, { label: "Active Strategies", value: String(sysStatus.active_strategies), color: "text-blue-400" }), _jsx(StatusItem, { label: "Total Generations", value: String(sysStatus.total_generations), color: "text-amber-400" }), _jsx(StatusItem, { label: "KST", value: sysStatus.timestamp_kst?.slice(0, 19) || '-', color: "text-text-muted" })] })] })), config && (_jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsx("div", { className: "p-3 border-b border-surface-border", children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Settings, { size: 14, className: "text-primary" }), _jsx("span", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Active Settings (Evolution Engine)" })] }) }), _jsxs("div", { className: "divide-y divide-surface-border", children: [_jsx(SettingsRow, { icon: BarChart3, label: "Population Size", value: String(config.population_size) }), _jsx(SettingsRow, { icon: GitBranch, label: "Mutation Rate", value: `${(config.mutation_rate * 100).toFixed(0)}%` }), _jsx(SettingsRow, { icon: Repeat, label: "Crossover Rate", value: `${(config.crossover_rate * 100).toFixed(0)}%` }), _jsx(SettingsRow, { icon: ToggleLeft, label: "Auto Evolution", value: config.evolution_enabled ? 'Enabled' : 'Disabled', color: config.evolution_enabled ? 'text-green-400' : 'text-red-400' }), _jsx(SettingsRow, { icon: Timer, label: "Backtest Interval", value: `${config.min_generation_interval_hours}h` }), _jsx(SettingsRow, { icon: Activity, label: "MDD Threshold", value: `${config.mdd_threshold}%` }), _jsx(SettingsRow, { icon: Activity, label: "Win Rate Threshold", value: `${config.winrate_threshold}%` }), _jsx(SettingsRow, { icon: Activity, label: "Return Threshold", value: `${config.return_threshold}%` })] })] }))] }));
}
function StatusItem({ label, value, color }) {
    return (_jsxs("div", { className: "bg-surface rounded-xl p-3", children: [_jsx("div", { className: "text-[10px] text-text-muted mb-1", children: label }), _jsx("div", { className: `text-sm font-bold ${color}`, children: value })] }));
}
function SettingsRow({ icon: Icon, label, value, color = 'text-text' }) {
    return (_jsxs("div", { className: "flex items-center justify-between px-4 py-2.5", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Icon, { size: 12, className: "text-text-muted" }), _jsx("span", { className: "text-xs text-text-muted", children: label })] }), _jsx("span", { className: `text-xs font-semibold ${color}`, children: value })] }));
}
