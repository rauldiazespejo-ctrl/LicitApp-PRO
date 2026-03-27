import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { logger } from '../config/logger';

export interface AuditEvent {
  tenantId?: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  durationMs?: number;
  statusCode?: number;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(event: AuditEvent): Promise<void> {
  try {
    await db('audit_logs').insert({
      tenant_id: event.tenantId ?? null,
      user_id: event.userId ?? null,
      action: event.action,
      resource: event.resource,
      resource_id: event.resourceId ?? null,
      ip_address: event.ipAddress ?? null,
      user_agent: event.userAgent ?? null,
      request_id: event.requestId ?? null,
      duration_ms: event.durationMs ?? null,
      status_code: event.statusCode ?? null,
      metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      created_at: new Date(),
    });
  } catch (err) {
    logger.error('Failed to write audit log', err);
  }
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const action = resolveAction(req.method, res.statusCode);
    const resource = resolveResource(req.path);

    writeAuditLog({
      tenantId: req.tenantId,
      userId: req.user?.sub,
      action,
      resource,
      resourceId: req.params?.id,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string,
      durationMs: Date.now() - startTime,
      statusCode: res.statusCode,
      metadata: {
        method: req.method,
        path: req.path,
        query: sanitizeQuery(req.query),
      },
    }).catch(() => {});
  });

  next();
}

function resolveAction(method: string, status: number): string {
  if (status >= 400) return 'ERROR';
  const map: Record<string, string> = {
    GET: 'READ',
    POST: 'CREATE',
    PUT: 'UPDATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE',
  };
  return map[method] ?? 'READ';
}

function resolveResource(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments.slice(0, 3).join('/') || 'unknown';
}

function sanitizeQuery(query: Record<string, unknown>): Record<string, unknown> {
  const REDACTED = '[REDACTED]';
  const sensitive = new Set(['password', 'token', 'secret', 'key', 'apikey', 'api_key']);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(query)) {
    result[k] = sensitive.has(k.toLowerCase()) ? REDACTED : v;
  }
  return result;
}
