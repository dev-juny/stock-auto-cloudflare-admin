import { Router, Request, Response } from 'express';
import { getPool } from '../db/oracle';
import { logger } from '../utils/logger';

const router = Router();

router.get('/api/health', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const dbStatus = pool ? 'connected' : 'disconnected';

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      db: dbStatus,
    });
  } catch (error) {
    logger.error('헬스 체크 실패', { error: (error as Error).message });
    res.status(500).json({ status: 'error', message: '헬스 체크 중 오류가 발생했습니다.' });
  }
});

router.get('/api/health/db', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ status: 'error', message: 'DB 연결 풀 없음' });
    }
    
    const conn = await pool.getConnection();
    try {
      const result = await conn.execute('SELECT 1 FROM DUAL');
      res.json({ status: 'ok', db: 'connected', queryResult: result.rows });
    } finally {
      conn.close();
    }
  } catch (error) {
    logger.error('DB health 체크 실패', { error: (error as Error).message });
    res.status(503).json({ status: 'error', message: 'DB 쿼리 실패' });
  }
});

export default router;
