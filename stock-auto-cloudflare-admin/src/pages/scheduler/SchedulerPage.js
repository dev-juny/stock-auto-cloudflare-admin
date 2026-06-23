import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { Play, Pause, RotateCw, RefreshCw, Timer, CheckCircle, XCircle, Zap } from 'lucide-react';
import { formatKST } from '../../utils/kst';
export default function SchedulerPage() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedJob, setSelectedJob] = useState(null);
    const [evoInfo, setEvoInfo] = useState(null);
    useEffect(() => {
        load();
        const iv = setInterval(load, 15000);
        return () => clearInterval(iv);
    }, []);
    async function load() {
        try {
            const [d, evo] = await Promise.all([
                api.get('/api/scheduler/jobs'),
                api.get('/api/scheduler/evolution'),
            ]);
            setJobs(d.jobs || []);
            setEvoInfo(evo);
        }
        catch { }
        finally {
            setLoading(false);
        }
    }
    async function loadDetail(jobId) {
        try {
            const d = await api.get(`/api/scheduler/jobs/${jobId}`);
            setSelectedJob(d);
        }
        catch { }
    }
    async function runJob(jobId) {
        try {
            await api.post(`/api/scheduler/jobs/${jobId}/run`);
            setTimeout(load, 1000);
        }
        catch { }
    }
    async function pauseJob(jobId) {
        try {
            await api.post(`/api/scheduler/jobs/${jobId}/pause`);
            load();
        }
        catch { }
    }
    async function resumeJob(jobId) {
        try {
            await api.post(`/api/scheduler/jobs/${jobId}/resume`);
            load();
        }
        catch { }
    }
    const statusIcon = (s) => {
        switch (s) {
            case 'RUNNING': return _jsx(CheckCircle, { size: 14, className: "text-green-400" });
            case 'PAUSED': return _jsx(Pause, { size: 14, className: "text-amber-400" });
            case 'FAILED': return _jsx(XCircle, { size: 14, className: "text-red-400" });
            default: return _jsx(Timer, { size: 14, className: "text-text-muted" });
        }
    };
    if (loading) {
        return _jsx("div", { className: "flex items-center justify-center h-48 text-xs text-text-muted", children: "Loading scheduler..." });
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-bold text-text", children: "Scheduler" }), _jsx("button", { onClick: load, className: "p-2 text-text-muted hover:text-text transition-colors", children: _jsx(RefreshCw, { size: 14 }) })] }), jobs.length === 0 ? (_jsx("div", { className: "bg-surface-card rounded-2xl border border-surface-border p-6 text-center text-xs text-text-muted", children: "No scheduler jobs found" })) : (_jsx("div", { className: "space-y-2", children: jobs.map((job) => (_jsx("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: _jsx("div", { className: "p-3", children: _jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [statusIcon(job.status), _jsx("span", { className: "text-sm font-medium text-text truncate", children: job.job_name }), _jsx("span", { className: `text-[10px] font-medium px-1.5 py-0.5 rounded-full ${job.status === 'RUNNING' ? 'bg-green-500/10 text-green-400' :
                                                        job.status === 'PAUSED' ? 'bg-amber-500/10 text-amber-400' :
                                                            'bg-surface-border text-text-muted'}`, children: job.status })] }), _jsxs("div", { className: "mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-text-muted", children: [_jsxs("span", { children: ["ID: ", job.job_id] }), job.cron_expression && _jsxs("span", { children: ["Cron: ", job.cron_expression] }), job.next_run_time && _jsxs("span", { children: ["Next: ", job.next_run_time_kst || formatKST(job.next_run_time)] })] })] }), _jsxs("div", { className: "flex items-center gap-1 shrink-0", children: [_jsx("button", { onClick: () => runJob(job.job_id), className: "p-1.5 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors", title: "Run now", children: _jsx(Play, { size: 14 }) }), job.status === 'RUNNING' ? (_jsx("button", { onClick: () => pauseJob(job.job_id), className: "p-1.5 text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors", title: "Pause", children: _jsx(Pause, { size: 14 }) })) : (_jsx("button", { onClick: () => resumeJob(job.job_id), className: "p-1.5 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors", title: "Resume", children: _jsx(Play, { size: 14 }) })), _jsx("button", { onClick: () => loadDetail(job.job_id), className: "p-1.5 text-text-muted hover:text-text rounded-lg transition-colors", title: "View history", children: _jsx(RotateCw, { size: 14 }) })] })] }) }) }, job.job_id))) })), evoInfo && evoInfo.status && (_jsxs("div", { className: "bg-surface-card rounded-2xl border border-surface-border overflow-hidden", children: [_jsxs("div", { className: "p-3 border-b border-surface-border flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Zap, { size: 14, className: "text-amber-400" }), _jsx("span", { className: "text-sm font-medium text-text", children: "Evolution Scheduler" })] }), _jsx("span", { className: `text-[10px] font-medium px-1.5 py-0.5 rounded-full ${evoInfo.status.status === 'running' ? 'bg-green-500/10 text-green-400' :
                                    evoInfo.status.status === 'idle' ? 'bg-blue-500/10 text-blue-400' :
                                        evoInfo.status.status?.startsWith('error') ? 'bg-red-500/10 text-red-400' :
                                            'bg-surface-border text-text-muted'}`, children: evoInfo.status.status })] }), _jsxs("div", { className: "p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs", children: [_jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Generation" }), _jsx("p", { className: "text-text font-bold text-sm", children: evoInfo.status.current_generation })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Interval" }), _jsx("p", { className: "text-text font-medium", children: evoInfo.config ? `${(evoInfo.config.min_generation_interval_hours * 60).toFixed(0)}m` : '-' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Last Run (KST)" }), _jsx("p", { className: "text-text font-medium", children: evoInfo.status.last_run_at_kst ? formatKST(evoInfo.status.last_run_at_kst) : '-' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Next Run (KST)" }), _jsx("p", { className: "text-text font-medium", children: evoInfo.status.next_scheduled_run_kst ? formatKST(evoInfo.status.next_scheduled_run_kst) : '-' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Active Strategies" }), _jsx("p", { className: "text-text font-medium", children: evoInfo.status.active_strategies })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Evolution Enabled" }), _jsx("p", { className: "text-text font-medium", children: evoInfo.config?.min_generation_interval_hours ? 'Yes' : 'No' })] })] }), evoInfo.recent_generations && evoInfo.recent_generations.length > 0 && (_jsxs("div", { className: "border-t border-surface-border", children: [_jsx("div", { className: "px-3 py-2", children: _jsx("span", { className: "text-[10px] font-semibold text-text-muted uppercase tracking-wider", children: "Recent Generations" }) }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-[11px]", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-text-muted border-t border-surface-border", children: [_jsx("th", { className: "text-left px-3 py-1.5 font-medium", children: "Gen" }), _jsx("th", { className: "text-right px-2 py-1.5 font-medium", children: "Fitness" }), _jsx("th", { className: "text-right px-2 py-1.5 font-medium", children: "Return" }), _jsx("th", { className: "text-right px-2 py-1.5 font-medium", children: "Win Rate" }), _jsx("th", { className: "text-right px-2 py-1.5 font-medium", children: "MDD" }), _jsx("th", { className: "text-right px-2 py-1.5 font-medium", children: "Time (KST)" })] }) }), _jsx("tbody", { className: "divide-y divide-surface-border", children: evoInfo.recent_generations.slice(0, 10).map(g => (_jsxs("tr", { className: "hover:bg-surface/50 transition-colors", children: [_jsx("td", { className: "px-3 py-1.5 text-text font-medium", children: g.generation }), _jsx("td", { className: "px-2 py-1.5 text-right text-amber-400", children: g.avg_fitness.toFixed(2) }), _jsxs("td", { className: `px-2 py-1.5 text-right ${g.avg_return >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [g.avg_return >= 0 ? '+' : '', g.avg_return.toFixed(2), "%"] }), _jsxs("td", { className: "px-2 py-1.5 text-right text-blue-400", children: [g.avg_winrate.toFixed(1), "%"] }), _jsxs("td", { className: "px-2 py-1.5 text-right text-red-400", children: [g.avg_mdd.toFixed(2), "%"] }), _jsx("td", { className: "px-2 py-1.5 text-right text-text-muted whitespace-nowrap", children: g.created_at_kst ? g.created_at_kst.split(' ')[1]?.slice(0, 5) : '-' })] }, g.generation))) })] }) })] }))] })), selectedJob && (_jsx("div", { className: "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40", children: _jsxs("div", { className: "bg-surface-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[70vh] overflow-y-auto", children: [_jsxs("div", { className: "sticky top-0 bg-surface-card border-b border-surface-border p-3 flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold text-text", children: selectedJob.job_name }), _jsx("button", { onClick: () => setSelectedJob(null), className: "text-text-muted hover:text-text text-lg leading-none", children: "\u00D7" })] }), _jsxs("div", { className: "p-4 space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs", children: [_jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Job ID" }), _jsx("p", { className: "text-text font-mono", children: selectedJob.job_id })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Status" }), _jsx("p", { className: "text-text", children: selectedJob.status })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Cron" }), _jsx("p", { className: "text-text font-mono", children: selectedJob.cron_expression || '-' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Next Run" }), _jsx("p", { className: "text-text", children: selectedJob.next_run_time_kst || formatKST(selectedJob.next_run_time) })] })] }), selectedJob.history && selectedJob.history.length > 0 && (_jsxs(_Fragment, { children: [_jsx("h4", { className: "text-xs font-semibold text-text-muted uppercase tracking-wider", children: "Execution History" }), _jsx("div", { className: "divide-y divide-surface-border", children: selectedJob.history.slice(0, 20).map((h) => (_jsxs("div", { className: "py-2 text-[11px]", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `font-medium ${h.status === 'SUCCESS' ? 'text-green-400' : h.status === 'FAIL' ? 'text-red-400' : 'text-text-muted'}`, children: h.status }), _jsxs("span", { className: "text-text-muted", children: [h.execution_time_ms, "ms"] }), _jsx("span", { className: "text-text-muted ml-auto", children: h.start_time_kst || formatKST(h.start_time) })] }), h.message && _jsx("p", { className: "text-text-muted mt-0.5 truncate", children: h.message })] }, h.id))) })] }))] })] }) }))] }));
}
