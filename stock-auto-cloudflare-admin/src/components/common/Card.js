import { jsx as _jsx } from "react/jsx-runtime";
export function Card({ children, className = '', onClick }) {
    return (_jsx("div", { className: `card ${onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''} ${className}`, onClick: onClick, children: children }));
}
