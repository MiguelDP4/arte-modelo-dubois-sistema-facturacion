import dotenv from 'dotenv';
import path from 'node:path';

const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

function requireDatabaseSafety(nodeEnv: string, databaseUrl: string): void {
  if (nodeEnv === 'test') {
    const lower = databaseUrl.toLowerCase();
    if (lower.includes('neon.tech') || lower.includes('neondb') || lower.includes('prod')) {
      throw new Error(
        'SAFETY_BLOCK: Prohibido ejecutar pruebas automatizadas contra Staging/Producción (Neon). Usa TEST_DATABASE_URL local.',
      );
    }
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';
const databaseUrl =
  nodeEnv === 'test'
    ? process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'file:./test.db'
    : process.env.DATABASE_URL || 'file:./dev.db';

requireDatabaseSafety(nodeEnv, databaseUrl);
process.env.DATABASE_URL = databaseUrl;

export const env = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT) || 4000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  databaseUrl,
  jwtAccessSecret:
    process.env.JWT_ACCESS_SECRET || 'arte-modelo-dev-access-secret-only-local',
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET || 'arte-modelo-dev-refresh-secret-only-local',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  emailProvider: (process.env.EMAIL_PROVIDER || 'mock').toLowerCase() as
    | 'mock'
    | 'smtp'
    | 'resend',
  emailFrom:
    process.env.EMAIL_FROM || '"Arte Modelo Dubois" <no-reply@artemodelodubois.gt>',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: Number(process.env.SMTP_PORT) || 465,
  smtpSecure: process.env.SMTP_SECURE !== 'false',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
};

export const REFRESH_COOKIE_NAME = 'amd_refresh_token';
export const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
