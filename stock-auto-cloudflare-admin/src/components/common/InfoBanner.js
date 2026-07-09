import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Info } from 'lucide-react';
export function InfoBanner({ title, description }) {
    return (_jsxs("div", { className: "flex items-start gap-2.5 bg-surface rounded-xl px-3 py-2.5 border border-surface-border", children: [_jsx(Info, { size: 14, className: "text-primary mt-0.5 shrink-0" }), _jsxs("div", { className: "text-[11px] text-text-muted leading-relaxed", children: [_jsx("strong", { className: "text-text", children: title }), " \u2014 ", description] })] }));
}
