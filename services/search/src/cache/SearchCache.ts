import crypto from 'crypto';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

const NS = 'search:v1:';

// TTL strategy
// - Text query present  → 60s  (results shift as new tenders arrive)
// - Filter-only query   → 120s (more stable)
// - Suggestions         → 300s (very stable)
const TTL_TEXT   = 60;
const TTL_FILTER = 120;
const TTL_SUGGEST = 300;

export function cacheKey(namespace: string, params: object): string {
  const canonical = JSON.stringify(params, Object.keys(params).sort());
  const hash = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 24);
  return `${NS}${namespace}:${hash}`;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const val = await redis.get(key);
    if (!val) return null;
    return JSON.parse(val) as T;
  } catch (err) {
    logger.warn(`[CACHE] Get error for ${key}:`, (err as Error).message);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    logger.warn(`[CACHE] Set error for ${key}:`, (err as Error).message);
  }
}

export async function invalidateSearchCache(): Promise<number> {
  try {
    let cursor = '0';
    let deleted = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${NS}*`, 'COUNT', '100');
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');
    logger.info(`[CACHE] Invalidated ${deleted} search cache keys`);
    return deleted;
  } catch (err) {
    logger.warn('[CACHE] Invalidation error:', (err as Error).message);
    return 0;
  }
}

export { TTL_TEXT, TTL_FILTER, TTL_SUGGEST };
