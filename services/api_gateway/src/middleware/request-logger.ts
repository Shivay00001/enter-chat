import type { Request, Response, NextFunction } from 'express';
import { logger } from '../shared/logger.js';

const requestLogger = logger.child({ component: 'http' });

/**
 * Structured request/response logging.
 * SECURITY: Authorization header is redacted by Pino serializer.
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    requestLogger[level]({
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration,
      correlationId: req.correlationId,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    }, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });

  next();
}
