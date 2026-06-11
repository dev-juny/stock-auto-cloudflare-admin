import { Router, Request, Response } from 'express';
import { getKisClient } from '../services/kis/client';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

let _balanceCache: any = null;
const CACHE_TTL = 120_000;
let _cacheTime = 0;

const router = Router();

router.get('/api/balance', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = await getKisClient().checkBalance();
    _balanceCache = data;
    _cacheTime = Date.now();
    res.json(data);
  } catch (error) {
    logger.error('잔고 조회 실패', { error: (error as Error).message });
    if (_balanceCache && Date.now() - _cacheTime < CACHE_TTL) {
      logger.info('캐시된 잔고 데이터 반환');
      res.json(_balanceCache);
    } else {
      res.status(502).json({ error: 'BALANCE_FAILED', message: '잔고 조회 중 오류가 발생했습니다.' });
    }
  }
});

export default router;
