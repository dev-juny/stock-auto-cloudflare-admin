import oracledb from 'oracledb';
import { config } from '../config';
import { logger } from '../utils/logger';

let pool: oracledb.Pool | null = null;

const TABLE_DDL = [
  `CREATE TABLE IF NOT EXISTS admin_sessions (
    session_id VARCHAR2(36) PRIMARY KEY,
    username VARCHAR2(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    ip_address VARCHAR2(45)
  )`,
  `CREATE TABLE IF NOT EXISTS app_event_logs (
    log_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    log_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    log_level VARCHAR2(20) DEFAULT 'INFO',
    source VARCHAR2(100),
    message VARCHAR2(4000),
    context CLOB
  )`,
];

export const initOracle = async () => {
  try {
    if (!config.ORACLE_WALLET_PATH || !config.ORACLE_DSN) {
      logger.warn('Oracle Wallet 설정이 없습니다. DB 연결을 건너뜁니다.');
      return;
    }

    logger.info('Oracle Thick mode 연결 시도...', { configDir: config.ORACLE_WALLET_PATH });
    oracledb.initOracleClient({ configDir: config.ORACLE_WALLET_PATH });

    pool = await oracledb.createPool({
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      connectString: config.ORACLE_DSN,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 1,
      poolTimeout: 60,
    });

    await ensureTables();
    logger.info('Oracle DB 연결 풀 및 테이블 확인 완료', { dsn: config.ORACLE_DSN });
  } catch (error) {
    logger.error('Oracle DB 초기화 실패', { error: (error as Error).message });
  }
};

const ensureTables = async () => {
  if (!pool) return;
  const conn = await pool.getConnection();
  try {
    for (const ddl of TABLE_DDL) {
      const match = ddl.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
      const tableName = match ? match[1] : 'Unknown';
      try {
        await conn.execute(ddl);
        logger.info(`테이블 확인 완료: ${tableName}`);
      } catch (tableErr) {
        logger.warn(`테이블 확인 중 경고: ${tableName}`, { error: (tableErr as Error).message });
      }
    }
    logger.info('모든 핵심 테이블 생성 확인 완료');
  } finally {
    conn.release();
  }
};

export const getPool = () => pool;

export const closeOracle = async () => {
  if (pool) {
    await pool.close(10);
    pool = null;
    logger.info('Oracle DB 연결 풀 종료');
  }
};

export const executeQuery = async <T>(sql: string, binds: unknown[] = []): Promise<T[]> => {
  if (!pool) throw new Error('Oracle 연결 풀이 초기화되지 않았습니다.');
  const conn = await pool.getConnection();
  try {
    const result = await conn.execute<T>(sql, binds);
    return result.rows || [];
  } finally {
    conn.release();
  }
};

export const executeNonQuery = async (sql: string, binds: unknown[] = []): Promise<void> => {
  if (!pool) throw new Error('Oracle 연결 풀이 초기화되지 않았습니다.');
  const conn = await pool.getConnection();
  try {
    await conn.execute(sql, binds, { autoCommit: true });
  } finally {
    conn.release();
  }
};

export const executeBatch = async (
  sql: string,
  binds: unknown[],
  options?: Record<string, unknown>
): Promise<void> => {
  if (!pool) throw new Error('Oracle 연결 풀이 초기화되지 않았습니다.');
  if (binds.length === 0) return;
  const conn = await pool.getConnection();
  try {
    await conn.execute('ALTER SESSION DISABLE PARALLEL DML');
    await (conn as any).executeMany(sql, binds, { autoCommit: true, ...options });
  } finally {
    conn.release();
  }
};
