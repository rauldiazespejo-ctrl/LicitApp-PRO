import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { redis } from '../config/redis';

export async function tenantMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const tenantId = req.headers['x-tenant-id'] as string ?? req.user?.tenantId;

  if (!tenantId) {
    res.status(400).json({ error: 'TenantRequired', message: 'X-Tenant-ID header es requerido' });
    return;
  }

  const cacheKey = `tenant:${tenantId}:active`;
  const cached = await redis?.get(cacheKey).catch(() => null);

  if (cached === 'true') {
    req.tenantId = tenantId;
    next();
    return;
  }

  const tenant = await db('tenants').where({ id: tenantId, is_active: true }).first();
  if (!tenant) {
    res.status(403).json({ error: 'TenantNotFound', message: 'Tenant no encontrado o inactivo' });
    return;
  }

  await redis?.setex(cacheKey, 300, 'true').catch(() => null);
  req.tenantId = tenantId;
  next();
}
