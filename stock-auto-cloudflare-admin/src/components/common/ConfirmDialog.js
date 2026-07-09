import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlertTriangle, X } from 'lucide-react';
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'primary', loading = false, onConfirm, onCancel, }) {
    if (!open)
        return null;
    const btnColor = variant === 'danger'
        ? 'bg-red-500 hover:bg-red-600 text-white'
        : 'bg-primary hover:bg-primary/90 text-white';
    return (_jsx("div", { className: "fixed inset-0 z-[60] flex items-center justify-center bg-black/40", onClick: onCancel, children: _jsxs("div", { className: "bg-surface-card border border-surface-border rounded-2xl p-5 max-w-sm w-full mx-3 shadow-xl", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center gap-3 mb-3", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center", children: _jsx(AlertTriangle, { size: 16, className: "text-amber-400" }) }), _jsx("h3", { className: "text-sm font-semibold text-text", children: title }), _jsx("button", { onClick: onCancel, className: "ml-auto text-text-muted hover:text-text", children: _jsx(X, { size: 14 }) })] }), _jsx("p", { className: "text-xs text-text-muted mb-4", children: message }), _jsxs("div", { className: "flex items-center gap-2 justify-end", children: [_jsx("button", { onClick: onCancel, disabled: loading, className: "text-xs px-3 py-1.5 rounded-lg bg-surface-border text-text-muted hover:text-text transition-colors disabled:opacity-50", children: cancelLabel }), _jsx("button", { onClick: onConfirm, disabled: loading, className: `text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${btnColor}`, children: loading ? 'Processing...' : confirmLabel })] })] }) }));
}
