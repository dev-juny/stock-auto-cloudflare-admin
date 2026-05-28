import dotenv from 'dotenv';
dotenv.config();
import { decryptValue } from '../utils/crypto';

const getSecure = (key: string, masterSecret: string) => {
  const val = process.env[key] || '';
  return val ? decryptValue(val, masterSecret) : '';
};

export const config = {
  PORT: Number(process.env.PORT) || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  MASTER_SECRET: process.env.MASTER_SECRET || '',

  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  SESSION_MAX_AGE: 3600000,

  ORACLE_WALLET_PATH: process.env.ORACLE_WALLET_PATH || '',
  ORACLE_DSN: process.env.ORACLE_DSN || '',
  DB_USER: process.env.DB_USER || '',
  DB_PASSWORD: process.env.DB_PASSWORD || '',

  KIS_BASE_URL: '',
  KIS_API_KEY: '',
  KIS_API_SECRET: '',
  KIS_ACCOUNT_NUMBER: '',
  KIS_MARKET: 'K',
  KIS_WS_URL: '',
  KIS_IS_MOCK: true,
};

export const initSecureConfig = () => {
  const isMock = (process.env.KIS_MODE || 'mock') !== 'real';
  config.KIS_IS_MOCK = isMock;

  if (!config.MASTER_SECRET) {
    throw new Error('MASTER_SECRET이 설정되지 않았습니다. Systemd Environment를 확인하세요.');
  }
  config.DB_PASSWORD = getSecure('DB_PASSWORD', config.MASTER_SECRET);

  const prefix = isMock ? 'KIS_MOCK' : 'KIS_PROD';
  config.KIS_BASE_URL = process.env[`${prefix}_BASE_URL`] || '';
  config.KIS_WS_URL = process.env[`${prefix}_WS_URL`] || '';
  config.KIS_API_KEY = getSecure(`${prefix}_API_KEY`, config.MASTER_SECRET);
  config.KIS_API_SECRET = getSecure(`${prefix}_API_SECRET`, config.MASTER_SECRET);
  config.KIS_ACCOUNT_NUMBER = getSecure(`${prefix}_ACCOUNT_NUMBER`, config.MASTER_SECRET);
  config.KIS_MARKET = process.env[`${prefix}_MARKET`] || 'K';
};
