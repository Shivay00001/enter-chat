import { z } from 'zod';

// --- Auth Domain Entities ---

export interface OtpVerification {
  id: string;
  channel: 'phone' | 'email';
  identifier: string;
  otpHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  verifiedAt: Date | null;
  createdAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  deviceId: string;
  refreshTokenHash: string;
  ipHash: string;
  userAgentHash: string;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  rotationCounter: number;
}

// --- Validation Schemas ---

export const otpStartSchema = z.object({
  channel: z.enum(['phone', 'email']),
  identifier: z.string().min(3).max(255),
});

export const otpVerifySchema = z.object({
  verificationId: z.string().uuid(),
  otp: z.string().min(4).max(8),
  device: z.object({
    platform: z.enum(['android', 'ios', 'web', 'desktop']),
    deviceName: z.string().max(100).optional(),
    publicKey: z.string().optional(),
  }),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
