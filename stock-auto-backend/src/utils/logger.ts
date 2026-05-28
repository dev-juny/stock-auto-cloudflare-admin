type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: Record<string, any>;
}

const colors = {
  info: '\x1b[36m', // cyan
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
  debug: '\x1b[90m', // gray
  reset: '\x1b[0m',
};

const formatLog = (entry: LogEntry): string => {
  const metaStr = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
  return `${colors[entry.level]}[${entry.level.toUpperCase()}]\x1b[0m ${entry.timestamp} - ${entry.message}${metaStr}`;
};

const log = (level: LogLevel, message: string, meta?: Record<string, any>) => {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    meta,
  };
  console.log(formatLog(entry));
};

export const logger = {
  info: (message: string, meta?: Record<string, any>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, any>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, any>) => log('error', message, meta),
  debug: (message: string, meta?: Record<string, any>) => log('debug', message, meta),
};
