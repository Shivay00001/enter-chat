import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

/**
 * Adds a correlation ID to every request for tracing.
 * Uses client-provided Correlation-ID header or generates one.
 */
export function correlationId(req: Request, _res: Response, next: NextFunction): void {
  const existing = req.headers['x-correlation-id'] || req.headers['correlation-id'];
  req.correlationId = (typeof existing === 'string' ? existing : uuidv4());
  _res.setHeader('X-Correlation-ID', req.correlationId);
  next();
}
