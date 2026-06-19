import { adminHtml } from '../templates/admin';
export const handleAdmin = () => {
    return new Response(adminHtml, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        },
    });
};
