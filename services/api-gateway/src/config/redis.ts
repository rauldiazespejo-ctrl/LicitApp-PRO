import Redis from 'ioredis';
import { config } from './env';
import { logger } from './logger';

export let redis: Redis;

export async function connectRedis(): Promise<void> {
  redis = new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  redis.on('error', (err) => logger.error('Redis error:', err));
  redis.on('reconnecting', () => logger.warn('Redis reconnecting...'));

  await redis.connect();
  await redis.ping();
}

export async function disconnectRedis(): Promise<void> {
  await redis?.quit();
}
