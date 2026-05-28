import express from 'express';
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

  // 라우트
  app.use(healthRoutes);
  app.use(authRoutes);
  app.use(balanceRoutes);
  app.use(logsRoutes);

  // 에러 핸들러 (반드시 마지막)
  app.use(errorHandler);

  return app;
};
