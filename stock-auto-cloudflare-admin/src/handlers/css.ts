import { baseCss } from '../css/base';
import { loginCss } from '../css/login';
import { dashboardCss } from '../css/dashboard';
import { logsCss } from '../css/logs';
import { modalCss } from '../css/modal';
import { backtestCss } from '../css/backtest';

const cssMap: Record<string, string> = {
  '/admin/css/base.css': baseCss,
  '/admin/css/login.css': loginCss,
  '/admin/css/dashboard.css': dashboardCss,
  '/admin/css/logs.css': logsCss,
  '/admin/css/modal.css': modalCss,
  '/admin/css/backtest.css': backtestCss,
};

export const handleCss = (pathname: string): Response | null => {
  const css = cssMap[pathname];
  if (!css) return null;
  return new Response(css, {
    headers: { 'Content-Type': 'text/css; charset=utf-8' },
  });
};
