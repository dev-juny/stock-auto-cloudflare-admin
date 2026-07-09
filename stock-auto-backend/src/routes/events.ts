import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';

const router = Router();

interface SSEClient {
  id: string;
  res: Response;
}

const clients: SSEClient[] = [];

export function broadcastEvent(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.res.write(payload);
    } catch {
      clients.splice(clients.indexOf(client), 1);
    }
  }
}

router.get('/api/events', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write('event: connected\ndata: {}\n\n');

  const client: SSEClient = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    res,
  };
  clients.push(client);

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const idx = clients.indexOf(client);
    if (idx !== -1) clients.splice(idx, 1);
  });
});

export default router;
