import type { AuthRepository, UserRepository, DeviceRepository } from '../ports/repositories.js';
import type { OtpVerification } from '../domain/entities.js';
import type { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

/**
 * PostgreSQL implementation of AuthRepository.
 * PRODUCTION: All queries use parameterized statements to prevent SQL injection.
 * Tokens are stored as SHA-256 hashes — never in plaintext.
 */
export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly pool: Pool) {}

  async createOtpVerification(data: Omit<OtpVerification, 'id' | 'createdAt'>) {
    const id = uuidv4();
    const createdAt = new Date();
    await this.pool.query(
      `INSERT INTO otp_verifications (id, channel, identifier, otp_hash, attempts, max_attempts, expires_at, verified_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, data.channel, data.identifier, data.otpHash, data.attempts, data.maxAttempts, data.expiresAt, data.verifiedAt, createdAt],
    );
    return { id, ...data, createdAt };
  }

  async getOtpVerification(id: string) {
    const { rows } = await this.pool.query(
      `SELECT id, channel, identifier, otp_hash as "otpHash", attempts, max_attempts as "maxAttempts",
              expires_at as "expiresAt", verified_at as "verifiedAt"
       FROM otp_verifications WHERE id = $1`,
      [id],
    );
    return rows[0] || null;
  }

  async incrementOtpAttempts(id: string) {
    await this.pool.query(
      `UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1`,
      [id],
    );
  }

  async markOtpVerified(id: string) {
    await this.pool.query(
      `UPDATE otp_verifications SET verified_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async createSession(data: {
    userId: string;
    deviceId: string;
    refreshTokenHash: string;
    ipHash: string;
    userAgentHash: string;
    issuedAt: Date;
    expiresAt: Date;
    revokedAt: Date | null;
    rotationCounter: number;
  }) {
    const id = uuidv4();
    await this.pool.query(
      `INSERT INTO sessions (id, user_id, device_id, refresh_token_hash, ip_hash, user_agent_hash,
                             issued_at, expires_at, revoked_at, rotation_counter)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, data.userId, data.deviceId, data.refreshTokenHash, data.ipHash, data.userAgentHash,
       data.issuedAt, data.expiresAt, data.revokedAt, data.rotationCounter],
    );
    return { id, ...data };
  }

  async getSessionByRefreshTokenHash(hash: string) {
    const { rows } = await this.pool.query(
      `SELECT id, user_id as "userId", device_id as "deviceId", refresh_token_hash as "refreshTokenHash",
              ip_hash as "ipHash", user_agent_hash as "userAgentHash",
              issued_at as "issuedAt", expires_at as "expiresAt", revoked_at as "revokedAt",
              rotation_counter as "rotationCounter"
       FROM sessions WHERE refresh_token_hash = $1`,
      [hash],
    );
    return rows[0] || null;
  }

  async rotateSessionRefreshToken(sessionId: string, newHash: string) {
    await this.pool.query(
      `UPDATE sessions SET refresh_token_hash = $2, rotation_counter = rotation_counter + 1
       WHERE id = $1`,
      [sessionId, newHash],
    );
  }

  async revokeSession(sessionId: string) {
    await this.pool.query(
      `UPDATE sessions SET revoked_at = NOW() WHERE id = $1`,
      [sessionId],
    );
  }

  async revokeAllUserSessions(userId: string) {
    await this.pool.query(
      `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }
}

/**
 * PostgreSQL implementation of UserRepository.
 */
export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string) {
    const { rows } = await this.pool.query(
      `SELECT id, display_name as "displayName" FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] || null;
  }

  async findByPhoneHash(phoneHash: Buffer) {
    const { rows } = await this.pool.query(
      `SELECT id, display_name as "displayName" FROM users WHERE phone_hash = $1`,
      [phoneHash],
    );
    return rows[0] || null;
  }

  async findByEmailHash(emailHash: Buffer) {
    const { rows } = await this.pool.query(
      `SELECT id, display_name as "displayName" FROM users WHERE email_hash = $1`,
      [emailHash],
    );
    return rows[0] || null;
  }

  async createUser(data: {
    id?: string;
    phoneHash?: Buffer;
    emailHash?: Buffer;
    displayName: string;
    homeRegion: string;
  }) {
    const id = data.id || uuidv4();
    await this.pool.query(
      `INSERT INTO users (id, phone_hash, email_hash, display_name, home_region, account_state, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())`,
      [id, data.phoneHash || null, data.emailHash || null, data.displayName, data.homeRegion],
    );
    return { id };
  }

  async deleteUser(userId: string) {
    // Soft delete — mark as deleted, scrub PII
    await this.pool.query(
      `UPDATE users SET
         account_state = 'deleted',
         phone_hash = NULL,
         email_hash = NULL,
         display_name = 'Deleted User',
         avatar_media_id = NULL,
         status_text = NULL,
         username = NULL,
         updated_at = NOW()
       WHERE id = $1`,
      [userId],
    );

    // Revoke all sessions
    await this.pool.query(
      `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );

    // Remove from all active chat memberships
    await this.pool.query(
      `UPDATE chat_members SET state = 'left' WHERE user_id = $1 AND state = 'active'`,
      [userId],
    );
  }
}

/**
 * PostgreSQL implementation of DeviceRepository.
 */
export class PostgresDeviceRepository implements DeviceRepository {
  constructor(private readonly pool: Pool) {}

  async findOrCreateDevice(data: {
    userId: string;
    deviceName: string;
    platform: string;
    publicKey?: string;
  }) {
    // Check for existing device
    const { rows: existing } = await this.pool.query(
      `SELECT id, user_id as "userId", device_name as "deviceName", platform,
              created_at as "createdAt"
       FROM devices WHERE user_id = $1 AND platform = $2 AND device_name = $3`,
      [data.userId, data.platform, data.deviceName],
    );

    if (existing[0]) {
      await this.pool.query(
        `UPDATE devices SET last_seen_at = NOW() WHERE id = $1`,
        [existing[0].id],
      );
      return existing[0];
    }

    const id = uuidv4();
    await this.pool.query(
      `INSERT INTO devices (id, user_id, device_name, platform, device_public_key, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [id, data.userId, data.deviceName, data.platform, data.publicKey ? Buffer.from(data.publicKey) : null],
    );

    return { id, ...data, createdAt: new Date() };
  }
}
