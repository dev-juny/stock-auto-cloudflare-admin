import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  let token = req.cookies?.admin_token;

  // Authorization header fallback
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch (e) {
    res.clearCookie('admin_token');
    return res.status(401).json({ error: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' });
  }
};
