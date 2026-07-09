import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
const ToastContext = createContext({ toast: () => { } });
export function useToast() {
    return useContext(ToastContext);
}
let nextId = 0;
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const toast = useCallback((type, message) => {
        const id = nextId++;
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);
    const remove = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);
    const icons = {
        success: CheckCircle,
        error: XCircle,
        warning: AlertTriangle,
        info: Info,
    };
    const colors = {
        success: 'bg-green-500/15 text-green-400 border-green-500/30',
        error: 'bg-red-500/15 text-red-400 border-red-500/30',
        warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        info: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    };
    return (_jsxs(ToastContext.Provider, { value: { toast }, children: [children, _jsx("div", { className: "fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] sm:w-auto", children: toasts.map(t => {
                    const Icon = icons[t.type];
                    return (_jsxs("div", { className: `flex items-start gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium animate-slide-up ${colors[t.type]}`, children: [_jsx(Icon, { size: 14, className: "shrink-0 mt-0.5" }), _jsx("span", { className: "flex-1", children: t.message }), _jsx("button", { onClick: () => remove(t.id), className: "shrink-0 opacity-60 hover:opacity-100", children: _jsx(X, { size: 12 }) })] }, t.id));
                }) })] }));
}
