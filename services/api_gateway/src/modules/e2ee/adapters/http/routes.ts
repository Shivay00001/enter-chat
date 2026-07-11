import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../../../middleware/auth.js';
import { getDbPool } from '../../../../shared/db.js';
import { logger } from '../../../../shared/logger.js';

const keysLogger = logger.child({ component: 'e2ee-keys' });

const keysRouter = Router();

const uploadBundleSchema = z.object({
  identityKey: z.string().min(1).max(1024),
  signedPrekey: z.string().min(1).max(1024),
  signedPrekeySignature: z.string().min(1).max(1024),
  prekeyId: z.number().int().min(0).default(0),
  oneTimePrekeys: z.array(z.object({
    keyId: z.number().int().min(0),
    publicKey: z.string().min(1).max(1024),
  })).max(100).optional(),
});

/**
 * POST /v1/keys/bundle
 * Upload E2EE key bundle for current device.
 * X3DH: identity key + signed prekey + optional one-time prekeys.
 */
keysRouter.post('/bundle', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const deviceId = req.deviceId!;
    const body = uploadBundleSchema.parse(req.body);

    const pool = getDbPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Upsert key bundle
      await client.query(
        `INSERT INTO key_bundles (device_id, user_id, identity_key, signed_prekey, signed_prekey_signature, prekey_id, uploaded_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (device_id) DO UPDATE SET
           identity_key = $3, signed_prekey = $4, signed_prekey_signature = $5, prekey_id = $6, uploaded_at = NOW()`,
        [deviceId, userId, body.identityKey, body.signedPrekey, body.signedPrekeySignature, body.prekeyId],
      );

      // Upload one-time prekeys if provided
      if (body.oneTimePrekeys && body.oneTimePrekeys.length > 0) {
        for (const opk of body.oneTimePrekeys) {
          await client.query(
            `INSERT INTO one_time_prekeys (device_id, user_id, key_id, public_key, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (device_id, key_id) DO UPDATE SET public_key = $4, consumed_at = NULL, created_at = NOW()`,
            [deviceId, userId, opk.keyId, opk.publicKey],
          );
        }
      }

      await client.query('COMMIT');

      keysLogger.info({ userId, deviceId, opkCount: body.oneTimePrekeys?.length ?? 0 }, 'Key bundle uploaded');

      res.json({ ok: true, prekeyId: body.prekeyId });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/keys/bundle/:userId
 * Fetch key bundle for a user's devices (for starting an E2EE session).
 * X3DH: Returns identity key, signed prekey, and one available one-time prekey per device.
 * The one-time prekey is consumed (marked as used) on fetch.
 */
keysRouter.get('/bundle/:userId', authMiddleware, async (req, res, next) => {
  try {
    const targetUserId = req.params['userId'];
    const pool = getDbPool();

    // Get all active device key bundles for the target user
    const { rows: bundles } = await pool.query(
      `SELECT kb.device_id as "deviceId", kb.identity_key as "identityKey",
              kb.signed_prekey as "signedPrekey", kb.signed_prekey_signature as "signedPrekeySignature",
              kb.prekey_id as "prekeyId"
       FROM key_bundles kb
       JOIN devices d ON d.id = kb.device_id
       WHERE kb.user_id = $1 AND d.revoked_at IS NULL`,
      [targetUserId],
    );

    if (bundles.length === 0) {
      res.status(404).json({
        error: { code: 'NO_KEY_BUNDLE', message: 'No key bundles available for this user' },
      });
      return;
    }

    // For each device, try to consume one OPK
    const result = [];
    for (const bundle of bundles) {
      // Atomically claim one OPK
      const { rows: opks } = await pool.query(
        `UPDATE one_time_prekeys SET consumed_at = NOW()
         WHERE id = (
           SELECT id FROM one_time_prekeys
           WHERE device_id = $1 AND consumed_at IS NULL
           ORDER BY key_id ASC LIMIT 1
         )
         RETURNING key_id as "keyId", public_key as "publicKey"`,
        [bundle.deviceId],
      );

      result.push({
        deviceId: bundle.deviceId,
        identityKey: bundle.identityKey,
        signedPrekey: bundle.signedPrekey,
        signedPrekeySignature: bundle.signedPrekeySignature,
        prekeyId: bundle.prekeyId,
        oneTimePrekey: opks[0] || null, // May be null if all consumed
      });
    }

    keysLogger.info({ targetUserId, deviceCount: result.length }, 'Key bundle fetched');

    res.json({ devices: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/keys/prekeys
 * Upload additional one-time prekeys.
 * Called when the server notifies the client that OPKs are running low.
 */
keysRouter.post('/prekeys', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const deviceId = req.deviceId!;

    const schema = z.object({
      prekeys: z.array(z.object({
        keyId: z.number().int().min(0),
        publicKey: z.string().min(1).max(1024),
      })).min(1).max(100),
    });

    const body = schema.parse(req.body);
    const pool = getDbPool();

    for (const opk of body.prekeys) {
      await pool.query(
        `INSERT INTO one_time_prekeys (device_id, user_id, key_id, public_key, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (device_id, key_id) DO UPDATE SET public_key = $4, consumed_at = NULL, created_at = NOW()`,
        [deviceId, userId, opk.keyId, opk.publicKey],
      );
    }

    // Count remaining available prekeys
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) as available FROM one_time_prekeys
       WHERE device_id = $1 AND consumed_at IS NULL`,
      [deviceId],
    );

    keysLogger.info({ userId, deviceId, uploaded: body.prekeys.length }, 'Prekeys uploaded');

    res.json({
      ok: true,
      uploaded: body.prekeys.length,
      availablePrekeys: parseInt(countRows[0].available, 10),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/keys/status
 * Get the current key status for the authenticated device.
 */
keysRouter.get('/status', authMiddleware, async (req, res, next) => {
  try {
    const deviceId = req.deviceId!;
    const pool = getDbPool();

    // Check key bundle
    const { rows: bundle } = await pool.query(
      `SELECT prekey_id as "prekeyId", uploaded_at as "uploadedAt"
       FROM key_bundles WHERE device_id = $1`,
      [deviceId],
    );

    // Count available prekeys
    const { rows: count } = await pool.query(
      `SELECT COUNT(*) as available FROM one_time_prekeys
       WHERE device_id = $1 AND consumed_at IS NULL`,
      [deviceId],
    );

    res.json({
      hasKeyBundle: bundle.length > 0,
      prekeyId: bundle[0]?.prekeyId ?? null,
      lastUpload: bundle[0]?.uploadedAt ?? null,
      availablePrekeys: parseInt(count[0].available, 10),
      needsReplenishment: parseInt(count[0].available, 10) < 10,
    });
  } catch (err) {
    next(err);
  }
});

export { keysRouter };
