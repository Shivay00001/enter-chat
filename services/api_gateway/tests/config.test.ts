import { describe, it, expect } from 'vitest';
import { config } from '../src/config/index.js';

describe('Config', () => {
  it('should load default configuration', () => {
    expect(config.port).toBeTypeOf('number');
    expect(config.wsPort).toBeTypeOf('number');
    expect(config.nodeEnv).toBeDefined();
    expect(config.jwt.secret).toBeDefined();
    expect(config.jwt.issuer).toBe('enterchat');
  });

  it('should have valid OTP configuration', () => {
    expect(config.otp.length).toBeGreaterThanOrEqual(4);
    expect(config.otp.length).toBeLessThanOrEqual(8);
    expect(config.otp.expirySeconds).toBeGreaterThan(0);
    expect(config.otp.maxAttempts).toBeGreaterThan(0);
  });

  it('should have valid message configuration', () => {
    expect(config.message.maxLength).toBeGreaterThan(0);
    expect(config.message.maxLength).toBeLessThanOrEqual(100000);
  });

  it('should have valid WebSocket configuration', () => {
    expect(config.ws.heartbeatIntervalMs).toBeGreaterThan(0);
    expect(config.ws.maxConnectionsPerUser).toBeGreaterThan(0);
  });
});
