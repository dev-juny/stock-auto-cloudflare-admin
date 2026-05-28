const PYTHON_PATHS = ['/api/backtest', '/api/positions'];

const pickBackend = (pathname: string, baseUrl: string, pythonUrl: string): string => {
  const base = (PYTHON_PATHS.some((p) => pathname.startsWith(p)) ? pythonUrl : baseUrl).replace(/\/+$/, '');
  return `${base}${pathname}`;
};

export const handleApiProxy = async (
  request: Request,
  backendBaseUrl: string,
  pythonBackendUrl: string
): Promise<Response> => {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const targetUrl = pickBackend(url.pathname + url.search, backendBaseUrl, pythonBackendUrl);

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

    const resp = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: body || undefined,
    });

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'PROXY_ERROR', message: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
