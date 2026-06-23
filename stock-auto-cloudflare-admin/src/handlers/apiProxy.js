const pickBackend = (pathname, baseUrl, pythonUrl) => {
    const base = baseUrl.replace(/\/+$/, '');
    const py = pythonUrl.replace(/\/+$/, '');
    if (pathname.startsWith('/api/backtest') || pathname.startsWith('/api/positions') || pathname.startsWith('/api/evolution') || pathname.startsWith('/api/portfolio') || pathname.startsWith('/api/strategies') || pathname.startsWith('/api/paper-trading') || pathname.startsWith('/api/settings') || pathname.startsWith('/api/logs') || pathname.startsWith('/api/system') || pathname.startsWith('/api/market') || pathname.startsWith('/api/scheduler')) {
        return `${py}${pathname}`;
    }
    return `${base}${pathname}`;
};
export const handleApiProxy = async (request, backendBaseUrl, _pythonBackendUrl) => {
    if (request.signal.aborted) {
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }
    try {
        const targetUrl = pickBackend(url.pathname + url.search, backendBaseUrl, _pythonBackendUrl);
        const headers = new Headers();
        const auth = request.headers.get('Authorization');
        if (auth)
            headers.set('Authorization', auth);
        const cookie = request.headers.get('Cookie');
        if (cookie)
            headers.set('Cookie', cookie);
        const hasBody = !['GET', 'HEAD', 'DELETE'].includes(request.method);
        if (hasBody) {
            headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');
        }
        const body = hasBody ? await request.text() : undefined;
        const timeoutMs = request.method === 'GET' ? 30000 : 60000;
        const controller = new AbortController();
        var timeoutId = setTimeout(function () { controller.abort(); }, timeoutMs);
        var onAbort = function () { controller.abort(); };
        request.signal.addEventListener('abort', onAbort);
        const resp = await fetch(targetUrl, {
            method: request.method,
            headers,
            body: body || undefined,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        request.signal.removeEventListener('abort', onAbort);
        if (request.signal.aborted) {
            return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        const respBody = await resp.text();
        return new Response(respBody, {
            status: 200, // Always return 200 to avoid 502 from Cloudflare
            headers: resp.headers,
        });
    }
    catch (err) {
        if (request.signal.aborted) {
            return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (err instanceof DOMException && err.name === 'AbortError') {
            return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'PROXY_ERROR', message: String(err) }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
