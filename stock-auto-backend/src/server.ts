import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import balanceRoutes from './routes/balance';
import logsRoutes from './routes/logs';
import backtestRoutes from './routes/backtest';

const PYTHON_TARGET = 'http://localhost:5000';
const PYTHON_PATHS = ['/api/backtest', '/api/positions'];


function pythonProxy(req: express.Request, res: express.Response) {
  const headers: Record<string, string> = {};
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'] as string;
  if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization'] as string;

  const options: http.RequestOptions = {
    method: req.method,
    hostname: 'localhost',
    port: 5000,
    path: req.originalUrl,
    headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.statusCode = proxyRes.statusCode || 500;
    res.setHeader('access-control-allow-origin', '*');
    proxyRes.pipe(res);
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

  // 미들웨어
  app.use(helmet({ contentSecurityPolicy: config.NODE_ENV === 'production' ? undefined : false }));
  app.use(cors({
    origin: config.NODE_ENV === 'production'
      ? ['https://stock-admin-production.hjjun1006.workers.dev', 'https://stock-admin.hjjun1006.workers.dev']
      : true,
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());

  // Python 프록시 (라우트보다 먼저)
  app.use((req, res, next) => {
    if (PYTHON_PATHS.some(p => req.path.startsWith(p))) {
      return pythonProxy(req, res);
    }
    next();
  });

  // 라우트
  app.use(healthRoutes);
  app.use(authRoutes);
  app.use(balanceRoutes);
  app.use(logsRoutes);
  app.use(backtestRoutes);

  // 에러 핸들러 (반드시 마지막)
  app.use(errorHandler);

  return app;
};
