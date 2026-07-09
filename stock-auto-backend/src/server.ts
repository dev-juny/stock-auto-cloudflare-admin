import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { requireAuth } from './middleware/auth';
import { logger } from './utils/logger';

import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import balanceRoutes from './routes/balance';
import logsRoutes from './routes/logs';
import backtestRoutes from './routes/backtest';
import eventsRoutes from './routes/events';

const PYTHON_TARGET = 'http://localhost:5000';
const PYTHON_PATHS = ['/api/backtest', '/api/positions', '/api/evolution', '/api/dashboard', '/api/strategies', '/api/portfolio', '/api/risk', '/api/scheduler', '/api/validation', '/api/paper-trading'];

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;

function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many requests' });
  }
  next();
}

function pythonProxy(req: express.Request, res: express.Response) {
  const headers: Record<string, string> = {};
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'] as string;
  if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization'] as string;
  if (req.headers['cookie']) headers['Cookie'] = req.headers['cookie'] as string;

  const options: http.RequestOptions = {
    method: req.method,
    hostname: 'localhost',
    port: 5000,
    path: req.originalUrl,
    headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    let body = '';
    proxyRes.on('data', (chunk) => { body += chunk; });
    proxyRes.on('end', () => {
      res.statusCode = proxyRes.statusCode || 500;
      res.setHeader('access-control-allow-origin', req.headers.origin || '*');
      res.setHeader('access-control-allow-credentials', 'true');
      res.end(body);
    });
  });

  proxyReq.on('error', () => {
    res.status(502).json({ error: 'PYTHON_PROXY_ERROR', message: 'Cannot reach Python backend' });
  });

  if (req.body && Object.keys(req.body).length > 0) {
    proxyReq.write(JSON.stringify(req.body));
  }
  proxyReq.end();
}

export const createApp = () => {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: config.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors({
    origin: config.NODE_ENV === 'production'
      ? ['https://stock-admin-production.hjjun1006.workers.dev', 'https://stock-admin.hjjun1006.workers.dev']
      : true,
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(rateLimit);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  });

  const publicPaths = ['/api/auth/login', '/api/auth/logout', '/api/health', '/api/health/'];

  app.use((req, res, next) => {
    if (publicPaths.includes(req.path)) return next();
    return requireAuth(req, res, next);
  });

  app.use((req, res, next) => {
    if (PYTHON_PATHS.some(p => req.path.startsWith(p))) {
      return pythonProxy(req, res);
    }
    next();
  });

  app.use(healthRoutes);
  app.use(eventsRoutes);
  app.use(authRoutes);
  app.use(balanceRoutes);
  app.use(logsRoutes);
  app.use(backtestRoutes);

  app.use(errorHandler);

  return app;
};
