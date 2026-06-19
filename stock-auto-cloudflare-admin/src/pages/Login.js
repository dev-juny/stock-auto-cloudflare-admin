import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
export function Login({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const err = await onLogin(username, password);
        setLoading(false);
        if (err)
            setError(err);
    };
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center px-6 bg-surface", children: _jsxs("div", { className: "w-full max-w-sm", children: [_jsxs("div", { className: "text-center mb-10", children: [_jsx("div", { className: "w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white font-bold text-xl mx-auto mb-4", children: "JJ" }), _jsx("h1", { className: "text-xl font-semibold text-text-primary", children: "\uC81C\uC774\uC81C\uC774 \uC5F0\uAD6C\uC18C" }), _jsx("p", { className: "text-sm text-text-muted mt-1", children: "\uC790\uB3D9\uB9E4\uB9E4 \uAD00\uB9AC \uC2DC\uC2A4\uD15C" })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs text-text-muted block mb-1.5", children: "\uC544\uC774\uB514" }), _jsxs("div", { className: "relative", children: [_jsx(User, { size: 16, className: "absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" }), _jsx("input", { type: "text", value: username, onChange: (e) => setUsername(e.target.value), className: "w-full h-11 pl-9 pr-3 rounded-xl bg-surface-card border border-surface-border text-text-primary text-sm placeholder:text-text-muted/50", placeholder: "admin", autoComplete: "username", autoFocus: true })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-text-muted block mb-1.5", children: "\uBE44\uBC00\uBC88\uD638" }), _jsxs("div", { className: "relative", children: [_jsx(Lock, { size: 16, className: "absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" }), _jsx("input", { type: showPw ? 'text' : 'password', value: password, onChange: (e) => setPassword(e.target.value), className: "w-full h-11 pl-9 pr-10 rounded-xl bg-surface-card border border-surface-border text-text-primary text-sm placeholder:text-text-muted/50", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", autoComplete: "current-password" }), _jsx("button", { type: "button", onClick: () => setShowPw(!showPw), className: "absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary min-h-[44px] min-w-[44px] flex items-center justify-center", children: showPw ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) })] })] }), error && (_jsx("div", { className: "text-xs text-danger bg-danger/10 rounded-lg px-3 py-2", children: error })), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary w-full h-11", children: loading ? '로그인 중...' : '로그인' })] })] }) }));
}
