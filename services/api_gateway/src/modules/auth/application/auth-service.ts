import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../../../config/index.js';
import { logger } from '../../../shared/logger.js';
import { BadRequestError, UnauthorizedError, RateLimitError } from '../../../shared/errors.js';
import type { AuthRepository, UserRepository, DeviceRepository, OtpSender } from '../ports/repositories.js';
import type { AuthTokenResponse } from '../../../shared/types.js';

const authLogger = logger.child({ component: 'auth-service' });

export class AuthService {
  constructor(
    private readonly authRepo: AuthRepository,
    private readonly userRepo: UserRepository,
    private readonly deviceRepo: DeviceRepository,
    private readonly otpSender: OtpSender,
  ) {}

  /**
   * Start OTP flow. Creates verification record and sends OTP.
   * SECURITY: OTP is generated server-side, never logged, hashed before storage.
   */
  async startOtp(channel: 'phone' | 'email', identifier: string): Promise<{ verificationId: string }> {
    // Generate OTP
    const otp = this.generateOtp(config.otp.length);
    const otpHash = await bcrypt.hash(otp, 10);

    const expiresAt = new Date(Date.now() + config.otp.expirySeconds * 1000);

    const verification = await this.authRepo.createOtpVerification({
      channel,
      identifier,
      otpHash,
      attempts: 0,
      maxAttempts: config.otp.maxAttempts,
      expiresAt,
      verifiedAt: null,
    });

    // Send OTP via configured provider (stub in dev)
    await this.otpSender.sendOtp(channel, identifier, otp);

    authLogger.info({ channel, verificationId: verification.id }, 'OTP verification started');
    // SECURITY: OTP value is NOT logged

    return { verificationId: verification.id };
  }

  /**
   * Verify OTP and issue tokens.
   * SECURITY: Constant-time comparison via bcrypt. Rate-limited by middleware.
   */
  async verifyOtp(
    verificationId: string,
    otp: string,
    device: { platform: string; deviceName?: string; publicKey?: string },
    ipHash: string,
    userAgentHash: string,
  ): Promise<AuthTokenResponse> {
    const verification = await this.authRepo.getOtpVerification(verificationId);

    if (!verification) {
      throw new BadRequestError('Invalid verification ID', 'INVALID_VERIFICATION');
    }

    if (verification.verifiedAt) {
      throw new BadRequestError('OTP already used', 'OTP_ALREADY_USED');
    }

    if (new Date() > verification.expiresAt) {
      throw new BadRequestError('OTP expired', 'OTP_EXPIRED');
    }

    if (verification.attempts >= verification.maxAttempts) {
      throw new RateLimitError(config.otp.expirySeconds, 'Too many failed attempts');
    }

    // Constant-time comparison via bcrypt
    const isValid = await bcrypt.compare(otp, verification.otpHash);

    if (!isValid) {
      await this.authRepo.incrementOtpAttempts(verificationId);
      throw new UnauthorizedError('Invalid OTP', 'INVALID_OTP');
    }

    await this.authRepo.markOtpVerified(verificationId);

    // Find or create user
    const identifierHash = this.hashIdentifier(verification.identifier);
    let user = verification.channel === 'phone'
      ? await this.userRepo.findByPhoneHash(identifierHash)
      : await this.userRepo.findByEmailHash(identifierHash);

    if (!user) {
      const created = await this.userRepo.createUser({
        phoneHash: verification.channel === 'phone' ? identifierHash : undefined,
        emailHash: verification.channel === 'email' ? identifierHash : undefined,
        displayName: 'New User',
        homeRegion: 'default',
      });
      user = { id: created.id, displayName: 'New User' };
    }

    // Register device
    const deviceRecord = await this.deviceRepo.findOrCreateDevice({
      userId: user.id,
      deviceName: device.deviceName || 'Unknown Device',
      platform: device.platform,
      publicKey: device.publicKey,
    });

    // Create session and tokens
    return this.createSessionAndTokens(user.id, deviceRecord.id, ipHash, userAgentHash);
  }

  /**
   * Refresh access token using refresh token.
   * Implements refresh token rotation for security.
   */
  async refreshToken(
    refreshToken: string,
    _ipHash: string,
    _userAgentHash: string,
  ): Promise<AuthTokenResponse> {
    const refreshTokenHash = this.hashToken(refreshToken);
    const session = await this.authRepo.getSessionByRefreshTokenHash(refreshTokenHash);

    if (!session) {
      throw new UnauthorizedError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    if (session.revokedAt) {
      // Possible token theft — revoke all sessions for this user
      authLogger.warn({ userId: session.userId }, 'Revoked refresh token reused — revoking all sessions');
      await this.authRepo.revokeAllUserSessions(session.userId);
      throw new UnauthorizedError('Session revoked', 'SESSION_REVOKED');
    }

    if (new Date() > session.expiresAt) {
      throw new UnauthorizedError('Refresh token expired', 'REFRESH_TOKEN_EXPIRED');
    }

    // Rotate refresh token
    const newRefreshToken = this.generateSecureToken();
    const newRefreshTokenHash = this.hashToken(newRefreshToken);
    await this.authRepo.rotateSessionRefreshToken(session.id, newRefreshTokenHash);

    const accessToken = this.generateAccessToken(session.userId, session.deviceId, session.id);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.parseExpiryToSeconds(config.jwt.accessTokenExpiry),
      user: {
        id: session.userId,
        username: null,
        displayName: '',
        avatarUrl: null,
        statusText: null,
        accountState: 'active',
      },
    };
  }

  /**
   * Logout — revoke session.
   */
  async logout(sessionId: string): Promise<void> {
    await this.authRepo.revokeSession(sessionId);
    authLogger.info({ sessionId }, 'Session revoked');
  }

  // --- Private helpers ---

  private async createSessionAndTokens(
    userId: string,
    deviceId: string,
    ipHash: string,
    userAgentHash: string,
  ): Promise<AuthTokenResponse> {
    const refreshToken = this.generateSecureToken();
    const refreshTokenHash = this.hashToken(refreshToken);

    const expiresAt = new Date(Date.now() + this.parseExpiryToSeconds(config.jwt.refreshTokenExpiry) * 1000);

    const session = await this.authRepo.createSession({
      userId,
      deviceId,
      refreshTokenHash,
      ipHash,
      userAgentHash,
      issuedAt: new Date(),
      expiresAt,
      revokedAt: null,
      rotationCounter: 0,
    });

    const accessToken = this.generateAccessToken(userId, deviceId, session.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiryToSeconds(config.jwt.accessTokenExpiry),
      user: {
        id: userId,
        username: null,
        displayName: '',
        avatarUrl: null,
        statusText: null,
        accountState: 'active',
      },
    };
  }

  private generateAccessToken(userId: string, deviceId: string, sessionId: string): string {
    return jwt.sign(
      { sub: userId, deviceId, sessionId },
      config.jwt.secret,
      {
        expiresIn: this.parseExpiryToSeconds(config.jwt.accessTokenExpiry),
        issuer: config.jwt.issuer,
        algorithm: 'HS256',
      },
    );
  }

  private generateOtp(length: number): string {
    const digits = '0123456789';
    let otp = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      otp += digits[bytes[i]! % 10];
    }
    return otp;
  }

  private generateSecureToken(): string {
    return crypto.randomBytes(48).toString('base64url');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private hashIdentifier(identifier: string): Buffer {
    return crypto.createHash('sha256').update(identifier.toLowerCase().trim()).digest();
  }

  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 900; // default 15 minutes
    const value = parseInt(match[1]!, 10);
    const unit = match[2];
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 900;
    }
  }
}
