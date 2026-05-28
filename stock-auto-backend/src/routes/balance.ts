import { Router, Request, Response } from 'express';
import { getKisClient } from '../services/kis/client';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

router.get('/api/balance', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = await getKisClient().checkBalance();
    res.json(data);
  } catch (error) {
    logger.error('잔고 조회 실패', { error: (error as Error).message });
    res.status(502).json({ error: 'BALANCE_FAILED', message: '잔고 조회 중 오류가 발생했습니다.' });
  }
});

export default router;
