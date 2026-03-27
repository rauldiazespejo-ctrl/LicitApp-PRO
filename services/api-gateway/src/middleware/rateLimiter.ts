import rateLimit from 'express-rate-limit';
import { redis } from '../config/redis';
import { config } from '../config/env';

export const rateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    return tenantId ? `tenant:${tenantId}` : req.ip ?? 'unknown';
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Has excedido el límite de solicitudes. Intenta de nuevo más tarde.',
      retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000),
    });
  },
});

export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Demasiados intentos. Por favor espera 15 minutos.',
  },
});
