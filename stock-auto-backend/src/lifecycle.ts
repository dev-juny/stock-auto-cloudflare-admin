import { createApp } from './server';
import { config, initSecureConfig } from './config';
import { initOracle, closeOracle } from './db/oracle';
import { logger } from './utils/logger';

let app: ReturnType<typeof createApp>;

export const start = async () => {
  try {
    initSecureConfig();
    logger.info('보안 설정 로드 완료');

    await initOracle();

    app = createApp();
    app.listen(config.PORT, '0.0.0.0', () => {
      logger.info(`서버 시작 - 포트: ${config.PORT}`, { env: config.NODE_ENV });
    });
  } catch (error) {
    logger.error('서버 시작 실패', { error: (error as Error).message });
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  logger.info(`${signal} 수신 - 서버 종료 시작`);
  await closeOracle();
  process.exit(0);
};

export const registerShutdownHandlers = () => {
  process.on('unhandledRejection', (reason) => {
    logger.error('처리되지 않은 Promise 거부', { error: (reason as Error).message });
  });

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};
