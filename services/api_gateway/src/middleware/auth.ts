import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UnauthorizedError } from '../shared/errors.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      deviceId?: string;
      sessionId?: string;
    }
  }
}

interface SupabaseJwtPayload {
  sub: string;
  aud: string;
  role: string;
  exp: number;
  iat: number;
  email?: string;
  phone?: string;
}

interface EnterChatJwtPayload {
  sub: string;
  deviceId?: string;
  sessionId?: string;
  iss: string;
  exp: number;
  iat: number;
}

/**
 * JWT authentication middleware — dual-mode.
 * Supports BOTH Supabase JWTs (aud === 'authenticated') and custom EnterChat JWTs (iss === 'enterchat').
 * Sets req.userId, req.deviceId, req.sessionId on success.
 *
 * SECURITY: Token is never logged. Validation errors return generic messages.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or invalid authorization header'));
    return;
  }

  const token = authHeader.slice(7);
  if (!token) {
    next(new UnauthorizedError('Missing token'));
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
    }) as Record<string, unknown>;

    // Dual-mode: detect JWT type by claims
    if (payload.aud === 'authenticated') {
      // Supabase JWT
      const supabasePayload = payload as unknown as SupabaseJwtPayload;
      req.userId = supabasePayload.sub;
      // Extract device/session from headers since Supabase JWT doesn't have them
      req.deviceId = req.headers['x-device-id'] as string | undefined;
      req.sessionId = req.headers['x-session-id'] as string | undefined;
    } else if (payload.iss === config.jwt.issuer) {
      // Custom EnterChat JWT (from auth-service.ts)
      const ecPayload = payload as unknown as EnterChatJwtPayload;
      req.userId = ecPayload.sub;
      req.deviceId = ecPayload.deviceId || (req.headers['x-device-id'] as string | undefined);
      req.sessionId = ecPayload.sessionId || (req.headers['x-session-id'] as string | undefined);
    } else {
      throw new Error('Unrecognized token format');
    }

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired', 'TOKEN_EXPIRED'));
    } else {
      next(new UnauthorizedError('Invalid token', 'INVALID_TOKEN'));
    }
  }
}

/**
 * Optional auth — sets user info if token present, but doesn't reject.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
    }) as Record<string, unknown>;

    if (payload.aud === 'authenticated') {
      req.userId = payload.sub as string;
    } else if (payload.iss === config.jwt.issuer) {
      req.userId = payload.sub as string;
      req.deviceId = payload.deviceId as string | undefined;
      req.sessionId = payload.sessionId as string | undefined;
    }
  } catch {
    // Silently ignore invalid tokens for optional auth
  }

  req.deviceId = req.deviceId || (req.headers['x-device-id'] as string | undefined);
  req.sessionId = req.sessionId || (req.headers['x-session-id'] as string | undefined);
  next();
}
