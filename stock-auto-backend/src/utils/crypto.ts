import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-cbc';

/**
 * 문자열 암호화 (AES-256-CBC)
 * @returns ENC:{iv}:{encrypted} 형식
 */
export const encryptValue = (text: string, secret: string): string => {
  const key = Buffer.from(secret.toString().padEnd(32, '0').slice(0, 32), 'utf8');
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `ENC:${iv.toString('hex')}:${encrypted}`;
};

/**
 * 문자열 복호화
 * ENC: 형식이 아니면 원본 반환
 */
export const decryptValue = (encryptedString: string, secret: string): string => {
  if (!encryptedString.startsWith('ENC:')) return encryptedString;

  const parts = encryptedString.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted string format');

  const [, ivHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(secret.toString().padEnd(32, '0').slice(0, 32), 'utf8');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};
