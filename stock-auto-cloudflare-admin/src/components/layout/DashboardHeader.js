import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
export function DashboardHeader() {
    const { logout } = useAuth();
    return (_jsx("header", { className: "sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-surface-border", children: _jsxs("div", { className: "flex items-center justify-between max-w-5xl mx-auto px-4 h-12", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xs", children: "JJ" }), _jsx("h1", { className: "text-sm font-semibold text-text-primary", children: "\uC81C\uC774\uC81C\uC774 \uC5F0\uAD6C\uC18C" })] }), _jsxs("button", { onClick: logout, className: "flex items-center gap-1.5 text-text-muted hover:text-text-primary transition-colors min-h-[44px] px-2", children: [_jsx(LogOut, { size: 16 }), _jsx("span", { className: "text-xs hidden sm:inline", children: "\uB85C\uADF8\uC544\uC6C3" })] })] }) }));
}
