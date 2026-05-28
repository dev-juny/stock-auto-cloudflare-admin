import { adminHtml } from '../templates/admin';

export const handleAdmin = (): Response => {
  return new Response(adminHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};
