import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { LayoutDashboard, PieChart, CandlestickChart, ScrollText, Settings, Zap, Timer, PlayCircle, Shield, ClipboardCheck } from 'lucide-react';
const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'portfolio', label: 'Portfolio', icon: PieChart },
    { id: 'evolution', label: 'Evolution', icon: Zap },
    { id: 'strategy', label: 'Strategy', icon: CandlestickChart },
    { id: 'paper-trading', label: 'Paper Trade', icon: PlayCircle },
    { id: 'validation', label: 'Validation', icon: ClipboardCheck },
    { id: 'risk', label: 'Risk', icon: Shield },
    { id: 'logs', label: 'Logs', icon: ScrollText },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'scheduler', label: 'Scheduler', icon: Timer },
];
export function BottomNavigation({ active, onChange }) {
    return (_jsx("nav", { className: "fixed bottom-0 left-0 right-0 z-50 bg-surface-card/95 backdrop-blur-lg border-t border-surface-border safe-area-bottom", children: _jsx("div", { className: "flex items-center justify-start overflow-x-auto scrollbar-none max-w-lg mx-auto", children: tabs.map((tab) => {
                const isActive = active === tab.id;
                const Icon = tab.icon;
                return (_jsxs("button", { onClick: () => onChange(tab.id), className: `flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 min-h-[52px] flex-1 shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-text-muted'}`, children: [_jsx(Icon, { size: 18 }), _jsx("span", { className: "text-[10px] font-medium leading-none whitespace-nowrap", children: tab.label })] }, tab.id));
            }) }) }));
}
