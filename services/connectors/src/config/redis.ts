export const redisConnection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

import Redis from 'ioredis';
import { logger } from './logger';

export let redis: Redis;

export async function connectRedis(): Promise<void> {
  redis = new Redis({ ...redisConnection, lazyConnect: true, maxRetriesPerRequest: 3 });
  redis.on('error', (err) => logger.error('Redis error:', err));
  await redis.connect();
}
