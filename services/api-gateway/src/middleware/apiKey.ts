import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { db } from '../config/database';
import { encryptionService } from '../services/EncryptionService';
import { writeAuditLog } from './auditLog';

const CACHE_TTL = 300;
const API_KEY_HEADER = 'x-api-key';

export async function apiKeyMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const rawKey = req.headers[API_KEY_HEADER] as string | undefined;
  if (!rawKey) {
    res.status(401).json({ error: 'AuthenticationRequired', message: 'Provide Bearer token or X-API-Key header' });
    return;
  }

  const keyHash = encryptionService.hashApiKey(rawKey);
  const cacheKey = `apikey:${keyHash}`;

  let apiKey: ApiKeyRecord | null = null;

  const cached = await redis.get(cacheKey);
  if (cached) {
    apiKey = JSON.parse(cached) as ApiKeyRecord;
  } else {
    const row = await db('api_keys')
      .where({ key_hash: keyHash, is_active: true })
      .first<ApiKeyRecord>();

    if (!row) {
      res.status(401).json({ error: 'InvalidApiKey' });
      return;
    }

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      res.status(401).json({ error: 'ApiKeyExpired' });
      return;
    }

    apiKey = row;
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(apiKey));
  }

  db('api_keys').where({ id: apiKey.id }).update({ last_used_at: new Date() }).catch(() => {});

  req.tenantId = apiKey.tenant_id;
  req.apiKeyId = apiKey.id;

  writeAuditLog({
    tenantId: apiKey.tenant_id,
    userId: apiKey.user_id,
    action: 'API_KEY_USE',
    resource: resolveResource(req.path),
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
    userAgent: req.headers['user-agent'],
    requestId: req.headers['x-request-id'] as string,
    metadata: { keyPrefix: rawKey.slice(0, 10) },
  }).catch(() => {});

  next();
}

function resolveResource(path: string): string {
  return path.split('/').filter(Boolean).slice(0, 3).join('/') || 'unknown';
}

interface ApiKeyRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  key_hash: string;
  scopes: string[];
  rate_limit: number;
  expires_at: string | null;
}
