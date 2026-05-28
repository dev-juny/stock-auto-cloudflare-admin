import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (err: ApiError, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  
  logger.error(`[${req.method}] ${req.originalUrl}`, {
    error: err.message,
    stack: err.stack,
  });

  res.status(statusCode).json({
    error: code,
    message: process.env.NODE_ENV === 'production' && statusCode === 500
      ? '서버 내부 오류가 발생했습니다.'
      : err.message,
  });
};
