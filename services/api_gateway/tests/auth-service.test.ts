import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

// We test the AuthService logic with mocked repositories.
// This avoids needing a running database.

// --- Mock implementations ---

function createMockAuthRepo() {
  const otpStore = new Map<string, any>();
  const sessionStore = new Map<string, any>();

  return {
    otpStore,
    sessionStore,

    createOtpVerification: vi.fn(async (data: any) => {
      const id = crypto.randomUUID();
      const record = { id, ...data };
      otpStore.set(id, record);
      return record;
    }),

    getOtpVerification: vi.fn(async (id: string) => otpStore.get(id) || null),

    incrementOtpAttempts: vi.fn(async (id: string) => {
      const record = otpStore.get(id);
      if (record) record.attempts++;
    }),

    markOtpVerified: vi.fn(async (id: string) => {
      const record = otpStore.get(id);
      if (record) record.verifiedAt = new Date();
    }),

    createSession: vi.fn(async (data: any) => {
      const id = crypto.randomUUID();
      const session = { id, ...data };
      sessionStore.set(id, session);
      return session;
    }),

    getSessionByRefreshTokenHash: vi.fn(async (hash: string) => {
      for (const session of sessionStore.values()) {
        if (session.refreshTokenHash === hash) return session;
      }
      return null;
    }),

    rotateSessionRefreshToken: vi.fn(async (sessionId: string, newHash: string) => {
      const session = sessionStore.get(sessionId);
      if (session) session.refreshTokenHash = newHash;
    }),

    revokeSession: vi.fn(async (sessionId: string) => {
      const session = sessionStore.get(sessionId);
      if (session) session.revokedAt = new Date();
    }),

    revokeAllUserSessions: vi.fn(async (_userId: string) => {}),
  };
}

function createMockUserRepo() {
  const users = new Map<string, any>();
  return {
    findByPhoneHash: vi.fn(async (_hash: Buffer) => null),
    findByEmailHash: vi.fn(async (_hash: Buffer) => null),
    createUser: vi.fn(async (data: any) => {
      const id = crypto.randomUUID();
      users.set(id, { id, ...data });
      return { id };
    }),
  };
}

function createMockDeviceRepo() {
  return {
    findOrCreateDevice: vi.fn(async (data: any) => ({
      id: crypto.randomUUID(),
      ...data,
    })),
  };
}

function createMockOtpSender() {
  const sentOtps: Array<{ channel: string; identifier: string; otp: string }> = [];
  return {
    sentOtps,
    sendOtp: vi.fn(async (channel: string, identifier: string, otp: string) => {
      sentOtps.push({ channel, identifier, otp });
    }),
  };
}

describe('AuthService', () => {
  let AuthService: any;
  let authRepo: ReturnType<typeof createMockAuthRepo>;
  let userRepo: ReturnType<typeof createMockUserRepo>;
  let deviceRepo: ReturnType<typeof createMockDeviceRepo>;
  let otpSender: ReturnType<typeof createMockOtpSender>;
  let service: any;

  beforeEach(async () => {
    // Dynamic import to load after config env is set
    const mod = await import('../src/modules/auth/application/auth-service.js');
    AuthService = mod.AuthService;

    authRepo = createMockAuthRepo();
    userRepo = createMockUserRepo();
    deviceRepo = createMockDeviceRepo();
    otpSender = createMockOtpSender();

    service = new AuthService(authRepo, userRepo, deviceRepo, otpSender);
  });

  describe('startOtp', () => {
    it('should create a verification record and send OTP', async () => {
      const result = await service.startOtp('phone', '+919876543210');

      expect(result.verificationId).toBeDefined();
      expect(typeof result.verificationId).toBe('string');
      expect(authRepo.createOtpVerification).toHaveBeenCalledOnce();
      expect(otpSender.sendOtp).toHaveBeenCalledOnce();

      // OTP should have been sent
      expect(otpSender.sentOtps.length).toBe(1);
      expect(otpSender.sentOtps[0]!.channel).toBe('phone');
      expect(otpSender.sentOtps[0]!.identifier).toBe('+919876543210');
      // OTP should be a numeric string of configured length (default 6)
      expect(otpSender.sentOtps[0]!.otp).toMatch(/^\d{6}$/);
    });

    it('should hash the OTP before storing', async () => {
      await service.startOtp('phone', '+919876543210');

      const createCall = authRepo.createOtpVerification.mock.calls[0]![0]!;
      // The stored hash should NOT be the raw OTP
      expect(createCall.otpHash).not.toMatch(/^\d{6}$/);
      // It should be a bcrypt hash
      expect(createCall.otpHash).toMatch(/^\$2[aby]?\$/);
    });
  });

  describe('verifyOtp', () => {
    it('should reject invalid verification ID', async () => {
      await expect(
        service.verifyOtp('nonexistent-id', '123456', { platform: 'android' }, 'ip', 'ua'),
      ).rejects.toThrow('Invalid verification ID');
    });

    it('should reject expired OTP', async () => {
      // Create OTP that expired in the past
      const otpHash = await bcrypt.hash('123456', 10);
      authRepo.otpStore.set('expired-id', {
        id: 'expired-id',
        channel: 'phone',
        identifier: '+919876543210',
        otpHash,
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() - 1000), // expired
        verifiedAt: null,
      });

      await expect(
        service.verifyOtp('expired-id', '123456', { platform: 'android' }, 'ip', 'ua'),
      ).rejects.toThrow('OTP expired');
    });

    it('should reject already-used OTP', async () => {
      const otpHash = await bcrypt.hash('123456', 10);
      authRepo.otpStore.set('used-id', {
        id: 'used-id',
        channel: 'phone',
        identifier: '+919876543210',
        otpHash,
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 300000),
        verifiedAt: new Date(), // already used
      });

      await expect(
        service.verifyOtp('used-id', '123456', { platform: 'android' }, 'ip', 'ua'),
      ).rejects.toThrow('OTP already used');
    });

    it('should reject wrong OTP and increment attempts', async () => {
      const otpHash = await bcrypt.hash('654321', 10);
      authRepo.otpStore.set('wrong-otp-id', {
        id: 'wrong-otp-id',
        channel: 'phone',
        identifier: '+919876543210',
        otpHash,
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 300000),
        verifiedAt: null,
      });

      await expect(
        service.verifyOtp('wrong-otp-id', '000000', { platform: 'android' }, 'ip', 'ua'),
      ).rejects.toThrow('Invalid OTP');

      expect(authRepo.incrementOtpAttempts).toHaveBeenCalledWith('wrong-otp-id');
    });

    it('should reject after max attempts exceeded', async () => {
      const otpHash = await bcrypt.hash('123456', 10);
      authRepo.otpStore.set('max-attempts-id', {
        id: 'max-attempts-id',
        channel: 'phone',
        identifier: '+919876543210',
        otpHash,
        attempts: 5,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 300000),
        verifiedAt: null,
      });

      await expect(
        service.verifyOtp('max-attempts-id', '123456', { platform: 'android' }, 'ip', 'ua'),
      ).rejects.toThrow('Too many failed attempts');
    });

    it('should succeed with correct OTP and return tokens', async () => {
      const otp = '123456';
      const otpHash = await bcrypt.hash(otp, 10);
      authRepo.otpStore.set('valid-id', {
        id: 'valid-id',
        channel: 'phone',
        identifier: '+919876543210',
        otpHash,
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 300000),
        verifiedAt: null,
      });

      const result = await service.verifyOtp(
        'valid-id',
        otp,
        { platform: 'android', deviceName: 'Test' },
        'ip-hash',
        'ua-hash',
      );

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBeGreaterThan(0);
      expect(result.user).toBeDefined();
      expect(result.user.id).toBeDefined();

      // Should have marked as verified
      expect(authRepo.markOtpVerified).toHaveBeenCalledWith('valid-id');
      // Should have created user (new phone)
      expect(userRepo.createUser).toHaveBeenCalled();
      // Should have created/found device
      expect(deviceRepo.findOrCreateDevice).toHaveBeenCalled();
      // Should have created session
      expect(authRepo.createSession).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should revoke the session', async () => {
      await service.logout('session-123');
      expect(authRepo.revokeSession).toHaveBeenCalledWith('session-123');
    });
  });
});
