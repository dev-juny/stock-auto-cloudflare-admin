import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { createSession } from '../services/sessionService';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/eventLogger';

const router = Router();

interface LoginBody {
  username?: string;
  password?: string;
}

router.post('/api/auth/login', async (req: Request<{}, any, LoginBody>, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: '아이디와 비밀번호를 입력하세요.' });
  }

  if (username !== config.ADMIN_USERNAME) {
    logEvent('LOGIN_FAILED', `아이디 불일치: ${username}`, 'WARN');
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: '잘못된 아이디 또는 비밀번호입니다.' });
  }

  const isMatch = await bcrypt.compare(password, config.ADMIN_PASSWORD_HASH);
  if (!isMatch) {
    logEvent('LOGIN_FAILED', `비밀번호 불일치: ${username}`, 'WARN');
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: '잘못된 아이디 또는 비밀번호입니다.' });
  }

  try {
    const token = jwt.sign(
      { username, role: 'admin' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );

    await createSession(username);

    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: config.SESSION_MAX_AGE,
    });

    logEvent('LOGIN_SUCCESS', `로그인 성공 (JWT 발급): ${username}`, 'INFO');
    res.json({ success: true, token });
  } catch (error) {
    logger.error('JWT 발급 실패', { error: (error as Error).message });
    res.status(500).json({ error: 'SERVER_ERROR', message: '로그인 처리 중 오류가 발생했습니다.' });
  }
});

router.post('/api/auth/logout', (req: Request, res: Response) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

router.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
  res.json({ success: true, username: (req as any).user.username });
});

export default router;
