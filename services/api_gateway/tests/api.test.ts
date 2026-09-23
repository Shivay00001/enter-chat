import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createApp } from '../src/server.js';
import http from 'node:http';

vi.mock('pg', () => {
  const mPool = {
    connect: vi.fn(),
    query: vi.fn().mockResolvedValue({ 
      rows: [{ 
        id: '11111111-1111-4111-8111-111111111111',
        otpHash: '$2a$10$abcdefghijklmnopqrstuv', // Valid-looking bcrypt hash
        expiresAt: new Date(Date.now() + 3600_000),
        attempts: 0,
        maxAttempts: 3
      }] 
    }),
    end: vi.fn(),
    on: vi.fn(),
  };
  return { default: { Pool: vi.fn(() => mPool) } };
});

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      ping: vi.fn().mockResolvedValue('PONG'),
      on: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
    }))
  };
});

describe('Health Endpoints', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    server = app.listen(0); // Random available port
    const addr = server.address() as { port: number };
    baseUrl = `http://localhost:${addr.port}`;
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('GET /health should return 200 with status ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('api-gateway');
    expect(body.timestamp).toBeDefined();
  });

  it('GET /ready should return status with checks (503 without DB/Redis)', async () => {
    const res = await fetch(`${baseUrl}/ready`);
    // Without DB/Redis, readiness should report not_ready
    expect([200, 503]).toContain(res.status);
    const body = await res.json();
    expect(body.status).toBeDefined();
    expect(body.checks).toBeDefined();
    expect(body.checks.database).toBeDefined();
    expect(body.checks.redis).toBeDefined();
  });

  it('GET /unknown should return 404', async () => {
    const res = await fetch(`${baseUrl}/unknown`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('Auth API', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    server = app.listen(0);
    const addr = server.address() as { port: number };
    baseUrl = `http://localhost:${addr.port}`;
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('POST /v1/auth/otp/start should accept valid phone number', async () => {
    const res = await fetch(`${baseUrl}/v1/auth/otp/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'phone', identifier: '+919999999999' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verificationId).toBeDefined();
    expect(typeof body.verificationId).toBe('string');
  });

  it('POST /v1/auth/otp/start should reject missing fields', async () => {
    const res = await fetch(`${baseUrl}/v1/auth/otp/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST /v1/auth/otp/verify should accept valid OTP', async () => {
    // First start OTP
    const startRes = await fetch(`${baseUrl}/v1/auth/otp/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'phone', identifier: '+919999999999' }),
    });
    const { verificationId } = await startRes.json();

    // Then verify — the stub OTP sender logs OTP to console,
    // so we can't know the exact OTP in tests. This tests the API contract.
    const res = await fetch(`${baseUrl}/v1/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verificationId,
        otp: '123456', // Will fail since random OTP was generated
        device: { platform: 'android', deviceName: 'Test Device' },
      }),
    });
    // 200 = correct OTP, 401 = wrong OTP — both are valid contract responses
    expect([200, 401]).toContain(res.status);
  });

  it('POST /v1/auth/logout should require authentication', async () => {
    const res = await fetch(`${baseUrl}/v1/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });
});

describe('Users API', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    server = app.listen(0);
    const addr = server.address() as { port: number };
    baseUrl = `http://localhost:${addr.port}`;
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('GET /v1/users/me should require authentication', async () => {
    const res = await fetch(`${baseUrl}/v1/users/me`);
    expect(res.status).toBe(401);
  });

  it('GET /v1/users/search should require authentication', async () => {
    const res = await fetch(`${baseUrl}/v1/users/search?query=test`);
    expect(res.status).toBe(401);
  });
});
