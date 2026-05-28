import crypto from 'crypto';
import { config } from '../config';
import { executeQuery, executeNonQuery } from '../db/oracle';
import { logger } from '../utils/logger';

export interface SessionRecord {
  session_id: string;
  username: string;
  expires_at: Date;
}

export const createSession = async (username: string): Promise<string> => {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + config.SESSION_MAX_AGE);

  await executeNonQuery(
    `INSERT INTO admin_sessions (session_id, username, expires_at) VALUES (:1, :2, :3)`,
    [id, username, expiresAt]
  );
  logger.info('세션 생성', { username, id });
  return id;
};

export const validateSession = async (sessionId: string): Promise<SessionRecord | null> => {
  const rows = await executeQuery<SessionRecord>(
    `SELECT session_id, username, expires_at FROM admin_sessions WHERE session_id = :1`,
    [sessionId]
  );
  const session = rows[0];

  if (!session || new Date(session.expires_at) < new Date()) {
    if (session) await destroySession(sessionId);
    return null;
  }

  // TTL 갱신
  const newExpiry = new Date(Date.now() + config.SESSION_MAX_AGE);
  await executeNonQuery(
    `UPDATE admin_sessions SET expires_at = :1 WHERE session_id = :2`,
    [newExpiry, sessionId]
  );
  return session;
};

export const destroySession = async (sessionId: string) => {
  await executeNonQuery(`DELETE FROM admin_sessions WHERE session_id = :1`, [sessionId]);
};
