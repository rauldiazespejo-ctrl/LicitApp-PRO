import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { redis } from '../config/redis';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  const dbStart = Date.now();
  try {
    await db.raw('SELECT 1');
    checks.database = { status: 'healthy', latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = { status: 'unhealthy', error: String(err) };
  }

  const redisStart = Date.now();
  try {
    await redis?.ping();
    checks.redis = { status: 'healthy', latencyMs: Date.now() - redisStart };
  } catch (err) {
    checks.redis = { status: 'unhealthy', error: String(err) };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION ?? '1.0.0',
    uptime: process.uptime(),
    checks,
  });
});

export default router;
