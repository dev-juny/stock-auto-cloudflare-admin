const pickBackend = (pathname: string, baseUrl: string, pythonUrl: string): string => {
  const base = baseUrl.replace(/\/+$/, '');
  const py = pythonUrl.replace(/\/+$/, '');
  if (pathname.startsWith('/api/backtest') || pathname.startsWith('/api/positions') || pathname.startsWith('/api/evolution') || pathname.startsWith('/api/portfolio') || pathname.startsWith('/api/strategies') || pathname.startsWith('/api/paper-trading') || pathname.startsWith('/api/settings') || pathname.startsWith('/api/logs') || pathname.startsWith('/api/system') || pathname.startsWith('/api/market') || pathname.startsWith('/api/scheduler') || pathname.startsWith('/api/risk') || pathname.startsWith('/api/pipeline') || pathname.startsWith('/api/production') || pathname.startsWith('/api/shadow')) {
    return `${py}${pathname}`;
  }
  return `${base}${pathname}`;
};

export const handleApiProxy = async (
  request: Request,
  backendBaseUrl: string,
  _pythonBackendUrl: string
): Promise<Response> => {
  if (request.signal.aborted) {
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const url = new URL(request.url);

  const ALLOWED_ORIGINS = [
    'https://stock-admin-production.hjjun1006.workers.dev',
    'https://stock-admin.hjjun1006.workers.dev',
    'http://localhost:3000',
    'http://localhost:5173',
  ];

  const origin = request.headers.get('Origin') || '';
  const corsHeaders: Record<string, string> = {};
  if (ALLOWED_ORIGINS.includes(origin)) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
    corsHeaders['Vary'] = 'Origin';
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const targetUrl = pickBackend(url.pathname + url.search, backendBaseUrl, _pythonBackendUrl);

    const headers = new Headers();
    const auth = request.headers.get('Authorization');
    if (auth) headers.set('Authorization', auth);
    const cookie = request.headers.get('Cookie');
    if (cookie) headers.set('Cookie', cookie);

    const hasBody = !['GET', 'HEAD', 'DELETE'].includes(request.method);
    if (hasBody) {
      headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');
    }

    const body = hasBody ? await request.text() : undefined;

    const timeoutMs = request.method === 'GET' ? 30000 : 60000;
    const controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort() }, timeoutMs);

    var onAbort = function () { controller.abort() };
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
      status: 200,  // Always return 200 to avoid 502 from Cloudflare
      headers: resp.headers,
    });
  } catch (err) {
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
