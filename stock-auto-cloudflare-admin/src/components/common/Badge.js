import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const variants = {
    success: 'bg-success/15 text-success',
    danger: 'bg-danger/15 text-danger',
    warning: 'bg-warning/15 text-warning',
    info: 'bg-primary/15 text-primary',
    muted: 'bg-surface-border text-text-muted',
};
export function Badge({ variant, children, className = '' }) {
    return (_jsxs("span", { className: `badge ${variants[variant]} ${className}`, children: [variant === 'success' && _jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-current" }), variant === 'danger' && _jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-current" }), variant === 'warning' && _jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-current" }), children] }));
}
