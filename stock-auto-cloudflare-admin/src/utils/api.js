const BASE = '';
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
async function request(path, opts = {}) {
    const headers = {
        ...opts.headers,
    };
    const token = getToken();
    if (token)
        headers['Authorization'] = `Bearer ${token}`;
    if (opts.body && typeof opts.body === 'string') {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
    const res = await fetch(`${BASE}${path}`, { ...opts, headers, credentials: 'include' });
    return res.json();
}
export const api = {
    get: (path) => request(path),
    post: (path, body) => request(path, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
    }),
    patch: (path, body) => request(path, {
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
    }),
    delete: (path) => request(path, { method: 'DELETE' }),
};
