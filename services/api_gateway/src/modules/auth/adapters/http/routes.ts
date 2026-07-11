import { Router } from 'express';
import { authMiddleware } from '../../../../middleware/auth.js';
import { PostgresAuthRepository, PostgresUserRepository, PostgresDeviceRepository } from '../postgres.js';
import { TwilioOtpSender } from '../twilio-otp.js';
import { StubOtpSender } from '../in-memory.js';
import { AuthService } from '../../application/auth-service.js';
import { otpStartSchema, otpVerifySchema, refreshTokenSchema } from '../../domain/entities.js';
import { getDbPool } from '../../../../shared/db.js';
import crypto from 'node:crypto';



// --- Dependency wiring ---
// In production with DB: use Postgres repos + real SMS provider.
function getAuthService() {
  const pool = getDbPool();
  const authRepo = new PostgresAuthRepository(pool);
  const userRepo = new PostgresUserRepository(pool);
  const deviceRepo = new PostgresDeviceRepository(pool);
  
  // Use Stub in test environment to avoid sending real SMS, Twilio otherwise.
  const otpSender = process.env.NODE_ENV === 'test' ? new StubOtpSender() : new TwilioOtpSender();
  
  return new AuthService(authRepo, userRepo, deviceRepo, otpSender);
}

// Postgres user repo for /sync route (uses Supabase Auth)
function getPgUserRepo() {
  return new PostgresUserRepository(getDbPool());
}

const authRouter = Router();

// ===== Custom OTP Auth Flow =====

/**
 * POST /v1/auth/otp/start
 * Start OTP verification — sends OTP via SMS/email.
 */
authRouter.post('/otp/start', async (req, res, next) => {
  try {
    const body = otpStartSchema.parse(req.body);
    const result = await getAuthService().startOtp(body.channel, body.identifier);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/otp/verify
 * Verify OTP and issue access + refresh tokens.
 */
authRouter.post('/otp/verify', async (req, res, next) => {
  try {
    const body = otpVerifySchema.parse(req.body);
    const ipHash = crypto.createHash('sha256').update(req.ip || 'unknown').digest('hex');
    const uaHash = crypto.createHash('sha256').update(req.headers['user-agent'] || 'unknown').digest('hex');

    const result = await getAuthService().verifyOtp(
      body.verificationId,
      body.otp,
      body.device,
      ipHash,
      uaHash,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/token/refresh
 * Refresh access token using refresh token (with rotation).
 */
authRouter.post('/token/refresh', async (req, res, next) => {
  try {
    const body = refreshTokenSchema.parse(req.body);
    const ipHash = crypto.createHash('sha256').update(req.ip || 'unknown').digest('hex');
    const uaHash = crypto.createHash('sha256').update(req.headers['user-agent'] || 'unknown').digest('hex');

    const result = await getAuthService().refreshToken(body.refreshToken, ipHash, uaHash);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/logout
 * Revoke the current session.
 */
authRouter.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    const sessionId = req.sessionId;
    if (!sessionId) {
      res.status(400).json({ error: { code: 'MISSING_SESSION', message: 'No session to revoke' } });
      return;
    }
    await getAuthService().logout(sessionId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ===== Supabase Auth Sync Flow =====

/**
 * POST /v1/auth/sync
 * Called by the mobile app immediately after signing in with Supabase Auth.
 * Ensures the user exists in our local `public.users` table and initializes their wallet.
 */
authRouter.post('/sync', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const phone = req.body.phone; // Passed from client after Supabase OTP verify

    const pgUserRepo = getPgUserRepo();

    // Check if user already exists
    const existingUser = await pgUserRepo.findById(userId);
    
    if (existingUser) {
      res.status(200).json({ status: 'synced', user: existingUser });
      return;
    }

    if (!phone) {
      res.status(400).json({ error: { code: 'MISSING_PHONE', message: 'Phone is required for new users' } });
      return;
    }

    // Create new user
    const newUser = await pgUserRepo.createUser({
      id: userId,
      displayName: 'New User',
      homeRegion: 'IN', // Defaulting to India for MVP
    });
    res.status(201).json({ status: 'created', user: newUser });
  } catch (err) {
    next(err);
  }
});

export { authRouter };
