import { executeNonQuery } from '../db/oracle';
import { logger } from '../utils/logger';
import { broadcastEvent } from '../routes/events';

type Severity = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export const logEvent = async (
  eventType: string,
  message: string,
  severity: Severity = 'INFO',
  metadata?: Record<string, any>
) => {
  broadcastEvent('log', { eventType, message, severity, metadata, timestamp: new Date().toISOString() });
  try {
    await executeNonQuery(
      `INSERT INTO app_event_logs (log_level, source, message, context) VALUES (:1, :2, :3, :4)`,
      [severity, eventType, message, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (error) {
    logger.error('Event log save failed', { error: (error as Error).message });
  }
};
