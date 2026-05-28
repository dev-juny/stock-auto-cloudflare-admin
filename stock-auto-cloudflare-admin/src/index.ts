import { handleAdmin } from './handlers/admin';
import { handleCss } from './handlers/css';
import { handleScript } from './handlers/scripts';
import { handleApiProxy } from './handlers/apiProxy';

export default {
  async fetch(request: Request, env: { BACKEND_BASE_URL: string; PYTHON_BACKEND_URL: string }): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      return handleAdmin();
    }

    const css = handleCss(url.pathname);
    if (css) return css;

    const script = handleScript(url.pathname);
    if (script) return script;

    if (url.pathname.startsWith('/api/')) {
      return handleApiProxy(request, env.BACKEND_BASE_URL, env.PYTHON_BACKEND_URL);
    }

    return new Response('Stock Admin Active', { status: 200 });
  },
};
