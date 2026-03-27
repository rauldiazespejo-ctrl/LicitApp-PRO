import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

function requireEnv(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

export const config = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.API_GATEWAY_PORT ?? '3000', 10),
  HOST: process.env.API_GATEWAY_HOST ?? '0.0.0.0',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',

  DATABASE_URL: `postgresql://${requireEnv('POSTGRES_USER', 'licitapp_user')}:${requireEnv('POSTGRES_PASSWORD', 'changeme')}@${requireEnv('POSTGRES_HOST', 'localhost')}:${requireEnv('POSTGRES_PORT', '5432')}/${requireEnv('POSTGRES_DB', 'licitapp_chile')}`,

  REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,

  JWT_SECRET: requireEnv('JWT_SECRET', 'dev_secret_change_in_production'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '24h',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d',

  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),

  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10),

  CONNECTORS_SERVICE_URL: process.env.CONNECTORS_SERVICE_URL ?? 'http://localhost:3001',
  SEARCH_SERVICE_URL: process.env.SEARCH_SERVICE_URL ?? 'http://localhost:3002',
  NOTIFICATIONS_SERVICE_URL: process.env.NOTIFICATIONS_SERVICE_URL ?? 'http://localhost:3003',

  PROMETHEUS_METRICS_PATH: '/metrics',
} as const;
