import { Request, Response, NextFunction } from 'express';
import * as DOMPurify from 'isomorphic-dompurify';

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()',
  );
  res.removeHeader('X-Powered-By');
  next();
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return DOMPurify.sanitize(value.trim());
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      sanitized[k] = sanitizeValue(v);
    }
    return sanitized;
  }
  return value;
}

export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query) as typeof req.query;
  }
  next();
}

const JSON_CONTENT_TYPES = ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data'];

export function validateContentType(req: Request, res: Response, next: NextFunction): void {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const ct = req.headers['content-type'] ?? '';
    const valid = JSON_CONTENT_TYPES.some((t) => ct.includes(t));
    if (!valid) {
      res.status(415).json({ error: 'UnsupportedMediaType' });
      return;
    }
  }
  next();
}
