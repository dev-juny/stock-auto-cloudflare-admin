import { config } from '../../config';
import { logger } from '../../utils/logger';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  access_token_token_expired: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;
let tokenPromise: Promise<string> | null = null;

export const getAccessToken = async (): Promise<string> => {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    return cachedToken.token;
  }

  if (tokenPromise) {
    return tokenPromise;
  }

  logger.info('KIS Access Token 발급 시도...');
  tokenPromise = (async () => {
    try {
      const response = await fetch(`${config.KIS_BASE_URL}/oauth2/tokenP`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          appkey: config.KIS_API_KEY,
          appsecret: config.KIS_API_SECRET,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Token request failed: ${response.status} ${errText}`);
      }

      const data = await response.json() as TokenResponse;
      
      cachedToken = {
        token: data.access_token,
        expiresAt: now + (data.expires_in * 1000),
      };

      logger.info('KIS Access Token 발급 성공', {
        expiresAt: new Date(cachedToken.expiresAt).toISOString(),
      });

      return cachedToken.token;
    } catch (error) {
      logger.error('KIS Access Token 발급 실패', { error: (error as Error).message });
      throw error;
    } finally {
      tokenPromise = null;
    }
  })();

  return tokenPromise;
};
