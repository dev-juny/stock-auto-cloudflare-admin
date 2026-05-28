import { authJs } from '../scripts/auth';
import { healthJs } from '../scripts/health';
import { balanceJs } from '../scripts/balance';
import { logsJs } from '../scripts/logs';
import { modalJs } from '../scripts/modal';
import { bootJs } from '../scripts/boot';

const scripts: Record<string, string> = {
  '/admin/js/auth.js': authJs,
  '/admin/js/health.js': healthJs,
  '/admin/js/balance.js': balanceJs,
  '/admin/js/logs.js': logsJs,
  '/admin/js/modal.js': modalJs,
  '/admin/js/boot.js': bootJs,
};

export const handleScript = (pathname: string): Response | null => {
  const js = scripts[pathname];
  if (!js) return null;
  return new Response(js, {
    headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
  });
};
