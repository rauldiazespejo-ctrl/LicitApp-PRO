import Redis from 'ioredis';
import { logger } from './logger';

export const redis = new Redis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_SEARCH_DB ?? '1', 10),
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  lazyConnect: true,
});

redis.on('error', (err) => logger.warn('[REDIS] Connection error:', err.message));
redis.on('connect', () => logger.info('[REDIS] Search cache connected'));

export async function connectRedisSearch(): Promise<void> {
  await redis.connect();
}
