import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
export function TourOverlay({ step, currentStep, totalSteps, onNext, onPrev, onFinish }) {
    const [dontShowAgain, setDontShowAgain] = useState(false);
    return (_jsx("div", { className: "fixed inset-0 z-[100] flex items-center justify-center bg-black/60", children: _jsxs("div", { className: "bg-surface-card border border-surface-border rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("span", { className: "text-[10px] font-medium text-text-muted uppercase tracking-wider", children: [currentStep + 1, " / ", totalSteps] }), _jsx("button", { onClick: onFinish, className: "p-1 text-text-muted hover:text-text transition-colors", children: _jsx(X, { size: 14 }) })] }), _jsx("h3", { className: "text-sm font-bold text-text mb-2", children: step.title }), _jsx("p", { className: "text-xs text-text-muted leading-relaxed mb-4", children: step.description }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "flex items-center gap-1", children: Array.from({ length: totalSteps }).map((_, i) => (_jsx("span", { className: `w-1.5 h-1.5 rounded-full transition-colors ${i === currentStep ? 'bg-primary' : 'bg-surface-border'}` }, i))) }), _jsxs("div", { className: "flex items-center gap-1.5", children: [currentStep > 0 && (_jsxs("button", { onClick: onPrev, className: "flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-surface text-text-muted hover:text-text transition-colors", children: [_jsx(ChevronLeft, { size: 12 }), " \uC774\uC804"] })), _jsxs("button", { onClick: onNext, className: "flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors", children: [currentStep < totalSteps - 1 ? '다음' : '완료', " ", _jsx(ChevronRight, { size: 12 })] })] })] }), _jsxs("label", { className: "flex items-center gap-1.5 mt-3 text-[10px] text-text-muted cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: dontShowAgain, onChange: e => {
                                setDontShowAgain(e.target.checked);
                                if (e.target.checked) {
                                    try {
                                        sessionStorage.setItem('tour_completed', 'true');
                                    }
                                    catch { }
                                }
                            }, className: "rounded border-surface-border bg-surface text-primary focus:ring-primary/40" }), "\uB2E4\uC2DC \uBCF4\uC9C0 \uC54A\uAE30"] })] }) }));
}
