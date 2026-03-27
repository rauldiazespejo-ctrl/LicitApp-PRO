import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { AuthTokenPayload, UserRole } from '@licitapp/shared';

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
      tenantId?: string;
      apiKeyId?: string;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Token de acceso requerido' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as AuthTokenPayload;
    req.user = payload;
    req.tenantId = payload.tenantId;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'TokenExpired', message: 'El token ha expirado' });
    } else {
      res.status(401).json({ error: 'InvalidToken', message: 'Token inválido' });
    }
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (roles.length && !roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Acceso denegado. Roles requeridos: ${roles.join(', ')}`,
      });
      return;
    }
    next();
  };
}
