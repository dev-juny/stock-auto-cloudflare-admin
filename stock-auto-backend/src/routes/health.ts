import { Router, Request, Response } from 'express';
import { getPool } from '../db/oracle';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/eventLogger';

const router = Router();
const startTime = Date.now();

router.get('/api/health', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const dbStatus = pool ? 'connected' : 'disconnected';
    const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
    const memUsage = process.memoryUsage();

    res.json({
      status: 'ok',
      service: 'node-backend',
      timestamp: new Date().toISOString(),
      uptime_seconds: uptimeSec,
      uptime_hours: Math.floor(uptimeSec / 3600),
      db: dbStatus,
      memory: {
        rss_mb: Math.round(memUsage.rss / 1024 / 1024),
        heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
        heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
        external_mb: Math.round(memUsage.external / 1024 / 1024),
      },
      node: process.version,
      env: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    logger.error('Health check failed', { error: (error as Error).message });
    res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
});

router.get('/api/health/db', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ status: 'error', message: 'DB pool not initialized' });
    }

    const start = Date.now();
    const conn = await pool.getConnection();
    try {
      const result = await conn.execute('SELECT 1 FROM DUAL');
      const queryTime = Date.now() - start;
      res.json({
        status: 'ok',
        db: 'connected',
        query_time_ms: queryTime,
        queryResult: result.rows,
      });
    } finally {
      conn.close();
    }
  } catch (error) {
    logger.error('DB health check failed', { error: (error as Error).message });
    logEvent('DB_HEALTH_FAILED', `DB health check failed: ${(error as Error).message}`, 'ERROR');
    res.status(503).json({ status: 'error', message: 'DB query failed' });
  }
});

router.get('/api/health/deep', async (req: Request, res: Response) => {
  const checks: Record<string, any> = {};
  const errors: string[] = [];

  // Check DB
  try {
    const pool = getPool();
    if (pool) {
      const start = Date.now();
      const conn = await pool.getConnection();
      await conn.execute('SELECT 1 FROM DUAL');
      conn.close();
      checks.db = { status: 'ok', response_time_ms: Date.now() - start };
    } else {
      checks.db = { status: 'disconnected' };
      errors.push('DB pool not initialized');
    }
  } catch (e) {
    checks.db = { status: 'error' };
    errors.push(`DB: ${(e as Error).message}`);
  }

  // Check Python backend
  try {
    const start = Date.now();
    const response = await fetch('http://localhost:5000/api/health');
    const data = await response.json();
    checks.python = { status: 'ok', response_time_ms: Date.now() - start, data };
  } catch (e) {
    checks.python = { status: 'error' };
    errors.push(`Python: ${(e as Error).message}`);
  }

  const memUsage = process.memoryUsage();
  const uptimeSec = Math.floor((Date.now() - startTime) / 1000);

  const healthy = errors.length === 0;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    uptime_seconds: uptimeSec,
    memory: {
      rss_mb: Math.round(memUsage.rss / 1024 / 1024),
      heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
    },
    checks,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  });
});

export default router;
