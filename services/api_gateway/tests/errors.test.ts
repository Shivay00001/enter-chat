import { describe, it, expect } from 'vitest';
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  RateLimitError,
  ConflictError,
} from '../src/shared/errors.js';

describe('Error Hierarchy', () => {
  it('BadRequestError should have correct status and code', () => {
    const err = new BadRequestError('Invalid input', 'VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Invalid input');
  });

  it('UnauthorizedError should have status 401', () => {
    const err = new UnauthorizedError('Token expired', 'TOKEN_EXPIRED');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('TOKEN_EXPIRED');
  });

  it('ForbiddenError should have status 403', () => {
    const err = new ForbiddenError('Not allowed');
    expect(err.statusCode).toBe(403);
  });

  it('NotFoundError should have status 404', () => {
    const err = new NotFoundError('User not found');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('User not found');
  });

  it('ConflictError should have status 409', () => {
    const err = new ConflictError('Already exists');
    expect(err.statusCode).toBe(409);
  });

  it('RateLimitError should have status 429 and retryAfter', () => {
    const err = new RateLimitError(60, 'Too fast');
    expect(err.statusCode).toBe(429);
    expect(err.retryAfterSeconds).toBe(60);
  });

  it('All errors should be instances of AppError', () => {
    const errors = [
      new BadRequestError('test'),
      new UnauthorizedError('test'),
      new ForbiddenError('test'),
      new NotFoundError('test'),
      new ConflictError('test'),
      new RateLimitError(30),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(Error);
      expect(err.statusCode).toBeDefined();
      expect(err.toJSON).toBeDefined();
    }
  });

  it('toJSON should produce correct error shape', () => {
    const err = new BadRequestError('Bad field', 'FIELD_INVALID');
    const json = err.toJSON();
    expect(json).toEqual({
      error: {
        code: 'FIELD_INVALID',
        message: 'Bad field',
      },
    });
  });
});
