import type { OtpVerification, Session } from '../domain/entities.js';

/**
 * Auth repository port (hexagonal architecture).
 * Implementations: PostgresAuthRepository (production), InMemoryAuthRepository (test).
 */
export interface AuthRepository {
  // OTP
  createOtpVerification(verification: Omit<OtpVerification, 'id' | 'createdAt'>): Promise<OtpVerification>;
  getOtpVerification(id: string): Promise<OtpVerification | null>;
  incrementOtpAttempts(id: string): Promise<void>;
  markOtpVerified(id: string): Promise<void>;

  // Sessions
  createSession(session: Omit<Session, 'id'>): Promise<Session>;
  getSessionByRefreshTokenHash(hash: string): Promise<Session | null>;
  revokeSession(id: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;
  rotateSessionRefreshToken(sessionId: string, newRefreshTokenHash: string): Promise<void>;
}

/**
 * User repository port for auth-related user operations.
 */
export interface UserRepository {
  findByPhoneHash(phoneHash: Buffer): Promise<{ id: string; displayName: string } | null>;
  findByEmailHash(emailHash: Buffer): Promise<{ id: string; displayName: string } | null>;
  createUser(data: {
    phoneHash?: Buffer;
    emailHash?: Buffer;
    displayName: string;
    homeRegion: string;
  }): Promise<{ id: string }>;
}

/**
 * Device repository port.
 */
export interface DeviceRepository {
  findOrCreateDevice(data: {
    userId: string;
    deviceName: string;
    platform: string;
    publicKey?: string;
  }): Promise<{ id: string }>;
}

/**
 * OTP delivery port.
 * Implementations: StubOtpSender (dev), TwilioOtpSender (production).
 */
export interface OtpSender {
  sendOtp(channel: 'phone' | 'email', identifier: string, otp: string): Promise<void>;
}
