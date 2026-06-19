/// <reference types="@cloudflare/workers-types" />

import { handleApiProxy } from './handlers/apiProxy';

interface Env {
  BACKEND_BASE_URL: string
  PYTHON_BACKEND_URL: string
  ASSETS: Fetcher
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (url.pathname.startsWith('/api/')) {
        return handleApiProxy(request, env.BACKEND_BASE_URL, env.PYTHON_BACKEND_URL);
      }

      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) return asset;
    } catch {
      // fall through to SPA fallback
    }

    // SPA fallback: serve index.html for client-side routing
    const index = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
    if (index.status === 200) return index;

    return new Response('Not Found', { status: 404 });
  },
};
