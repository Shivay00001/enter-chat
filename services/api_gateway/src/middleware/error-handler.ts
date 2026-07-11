import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, RateLimitError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';

const errorLogger = logger.child({ component: 'error-handler' });

/**
 * Centralized error handler.
 * Transforms known errors into the API error format.
 * Unknown errors return 500 with generic message (no internal details leaked).
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Zod validation errors → 400
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
        correlationId: req.correlationId,
      },
    });
    return;
  }

  // Known application errors
  if (err instanceof AppError) {
    if (!err.isOperational) {
      errorLogger.error({ err, correlationId: req.correlationId }, 'Non-operational error');
    }

    const response: Record<string, unknown> = {
      error: {
        code: err.code,
        message: err.message,
        correlationId: req.correlationId,
      },
    };

    if (err instanceof RateLimitError) {
      (response['error'] as Record<string, unknown>)['retryAfterSeconds'] = err.retryAfterSeconds;
      res.setHeader('Retry-After', String(err.retryAfterSeconds));
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Unknown errors — never leak internals
  errorLogger.error({ err, correlationId: req.correlationId }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      correlationId: req.correlationId,
    },
  });
}
