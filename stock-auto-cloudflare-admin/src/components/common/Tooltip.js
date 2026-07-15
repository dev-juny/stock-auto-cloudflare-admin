import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';
export function Tooltip({ text, content, children, direction = 'top', size = 14, className = '' }) {
    const [show, setShow] = useState(false);
    const wrapperRef = useRef(null);
    const timeoutRef = useRef();
    const tooltipText = text || content || '';
    useEffect(() => {
        if (!show)
            return;
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setShow(false);
            }
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [show]);
    const posStyles = {
        top: 'bottom-full left-0 sm:left-1/2 sm:-translate-x-1/2 mb-2',
        bottom: 'top-full left-0 sm:left-1/2 sm:-translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };
    return (_jsxs("span", { ref: wrapperRef, className: `relative inline-flex items-center gap-1 ${className}`, onMouseEnter: () => {
            clearTimeout(timeoutRef.current);
            setShow(true);
        }, onMouseLeave: () => {
            timeoutRef.current = setTimeout(() => setShow(false), 200);
        }, onFocus: () => setShow(true), onBlur: () => setShow(false), onClick: (e) => {
            e.stopPropagation();
            setShow(s => !s);
        }, children: [children, tooltipText && (_jsxs(_Fragment, { children: [_jsx(Info, { size: size, className: "text-text-muted hover:text-text cursor-pointer transition-colors shrink-0" }), show && (_jsx("span", { className: `absolute z-50 ${posStyles[direction]} min-w-[140px] sm:min-w-[200px] max-w-[90vw] sm:max-w-[280px] p-2.5 text-xs leading-relaxed text-white bg-gray-800 rounded-lg shadow-lg`, onMouseEnter: () => setShow(true), onMouseLeave: () => setShow(false), children: tooltipText }))] }))] }));
}
