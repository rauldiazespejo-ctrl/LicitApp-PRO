import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction): void {
  const statusCode = err.statusCode ?? 500;
  const isProduction = process.env.NODE_ENV === 'production';

  logger.error({
    message: err.message,
    code: err.code,
    statusCode,
    requestId: req.requestId,
    path: req.path,
    method: req.method,
    stack: isProduction ? undefined : err.stack,
  });

  res.status(statusCode).json({
    error: err.code ?? 'InternalServerError',
    message: statusCode === 500 && isProduction ? 'Error interno del servidor' : err.message,
    requestId: req.requestId,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}

export function createError(message: string, statusCode: number, code?: string): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  err.code = code;
  return err;
}
