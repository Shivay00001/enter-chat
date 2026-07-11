import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
import type { Request, Response } from 'express';

/**
 * General rate limiter for all routes.
 * Uses token bucket via express-rate-limit.
 * Keyed by IP address.
 */
export const generalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use X-Forwarded-For if behind a proxy, otherwise req.ip
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
        retryAfterSeconds: Math.ceil(config.rateLimit.windowMs / 1000),
      },
    });
  },
});

/**
 * Strict rate limiter for OTP start endpoint.
 * Prevents OTP spam/abuse.
 */
export const otpStartRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.otpStartMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many OTP requests. Please wait before trying again.',
        retryAfterSeconds: Math.ceil(config.rateLimit.windowMs / 1000),
      },
    });
  },
});

/**
 * Strict rate limiter for OTP verify endpoint.
 * Prevents brute force OTP guessing.
 */
export const otpVerifyRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.otpVerifyMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many verification attempts. Please wait.',
        retryAfterSeconds: Math.ceil(config.rateLimit.windowMs / 1000),
      },
    });
  },
});
