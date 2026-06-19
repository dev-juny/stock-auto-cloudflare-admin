import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Skeleton({ className = '' }) {
    return _jsx("div", { className: `skeleton ${className}` });
}
export function CardSkeleton() {
    return (_jsxs("div", { className: "card space-y-3", children: [_jsx(Skeleton, { className: "h-4 w-24" }), _jsx(Skeleton, { className: "h-8 w-32" }), _jsx(Skeleton, { className: "h-3 w-20" })] }));
}
export function ListSkeleton({ rows = 3 }) {
    return (_jsx("div", { className: "space-y-2", children: Array.from({ length: rows }).map((_, i) => (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Skeleton, { className: "h-10 w-10 rounded-full" }), _jsxs("div", { className: "flex-1 space-y-1.5", children: [_jsx(Skeleton, { className: "h-3.5 w-3/4" }), _jsx(Skeleton, { className: "h-3 w-1/2" })] })] }, i))) }));
}
