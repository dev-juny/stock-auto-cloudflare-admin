import { executeNonQuery } from '../db/oracle';
import { logger } from '../utils/logger';

type Severity = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export const logEvent = async (
  eventType: string,
  message: string,
  severity: Severity = 'INFO',
  metadata?: Record<string, any>
) => {
  try {
    await executeNonQuery(
      `INSERT INTO app_event_logs (log_level, source, message, context) VALUES (:1, :2, :3, :4)`,
      [severity, eventType, message, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (error) {
    logger.error('이벤트 로그 저장 실패', { error: (error as Error).message });
  }
};
