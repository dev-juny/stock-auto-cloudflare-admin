const BASE = '';
const REQUEST_TIMEOUT = 30000;
const MAX_RETRIES = 2;
function getToken() {
    return sessionStorage.getItem('admin_token') || '';
}
export function setToken(t) {
    sessionStorage.setItem('admin_token', t);
}
export function clearToken() {
    sessionStorage.removeItem('admin_token');
}
export function hasToken() {
    return !!getToken();
}
async function request(path, opts = {}, reqOpts = {}) {
    const timeout = reqOpts.timeout ?? REQUEST_TIMEOUT;
    const maxRetries = reqOpts.retries ?? MAX_RETRIES;
    const headers = {
        ...opts.headers,
    };
    const token = getToken();
    if (token)
        headers['Authorization'] = `Bearer ${token}`;
    if (opts.body && typeof opts.body === 'string') {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const combinedSignal = reqOpts.signal
                ? combineAbortSignals(reqOpts.signal, controller.signal)
                : controller.signal;
            const res = await fetch(`${BASE}${path}`, {
                ...opts,
                headers,
                credentials: 'include',
                signal: combinedSignal,
            });
            if (!res.ok) {
                let errorMsg = `HTTP ${res.status}`;
                try {
                    const body = await res.json();
                    errorMsg = body?.detail?.[0]?.msg || body?.detail || errorMsg;
                }
                catch { }
                throw new Error(errorMsg);
            }
            const body = await res.json();
            return body;
        }
        catch (e) {
            lastError = e;
            if (e.name === 'AbortError') {
                if (reqOpts.signal?.aborted)
                    throw new Error('Request cancelled');
                throw new Error(`Request timed out after ${timeout}ms`);
            }
            if (attempt < maxRetries && isRetryable(e))
                continue;
            throw e;
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    throw lastError || new Error('Request failed');
}
function isRetryable(err) {
    const msg = err.message || '';
    if (msg.includes('timed out'))
        return true;
    if (msg.includes('Failed to fetch'))
        return true;
    if (msg.includes('NetworkError'))
        return true;
    if (msg.includes('429') || msg.includes('503') || msg.includes('502'))
        return true;
    return false;
}
function combineAbortSignals(...signals) {
    const controller = new AbortController();
    for (const signal of signals) {
        if (signal.aborted) {
            controller.abort(signal.reason);
            return controller.signal;
        }
        signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
    }
    return controller.signal;
}
export const api = {
    get: (path, reqOpts) => request(path, {}, reqOpts),
    post: (path, body, reqOpts) => request(path, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
    }, reqOpts),
    patch: (path, body, reqOpts) => request(path, {
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
    }, reqOpts),
    delete: (path, reqOpts) => request(path, { method: 'DELETE' }, reqOpts),
};
