import Redis from 'ioredis';
import { logger } from './logger';
export const redisConnection = { host: process.env.REDIS_HOST ?? 'localhost', port: parseInt(process.env.REDIS_PORT ?? '6379', 10), password: process.env.REDIS_PASSWORD || undefined };
export let redis: Redis;
export async function connectRedis() { redis = new Redis({ ...redisConnection, lazyConnect: true, maxRetriesPerRequest: 3 }); redis.on('error', (e) => logger.error('Redis:', e)); await redis.connect(); }
