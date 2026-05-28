import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { executeQuery, executeNonQuery } from '../db/oracle';
import { logger } from '../utils/logger';

const router = Router();

router.get('/api/logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const rows = await executeQuery<any[]>(
      `SELECT log_id, log_level, source, message, context, log_time AS created_at
       FROM app_event_logs
       ORDER BY log_time DESC
       FETCH FIRST :1 ROWS ONLY`,
      [limit]
    );
    const mapped = rows.map(r => ({
      LOG_ID: r[0],
      LOG_LEVEL: r[1],
      SOURCE: r[2],
      MESSAGE: r[3],
      CONTEXT: r[4],
      CREATED_AT: r[5],
    }));
    res.json(mapped);
  } catch (error) {
    logger.error('로그 조회 실패', { error: (error as Error).message });
    res.status(503).json({ error: 'LOG_QUERY_FAILED', message: '로그 조회 중 오류가 발생했습니다.' });
  }
});

router.delete('/api/logs/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const logId = parseInt(req.params.id as string);
    if (isNaN(logId)) {
      return res.status(400).json({ error: 'INVALID_ID', message: '올바르지 않은 로그 ID입니다.' });
    }

    await executeNonQuery(
      'DELETE FROM app_event_logs WHERE log_id = :1',
      [logId]
    );

    logger.info('로그 삭제 완료', { logId });
    res.json({ success: true });
  } catch (error) {
    logger.error('로그 삭제 실패', { error: (error as Error).message });
    res.status(503).json({ error: 'LOG_DELETE_FAILED', message: '로그 삭제 중 오류가 발생했습니다.' });
  }
});

export default router;
