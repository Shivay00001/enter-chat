import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../../../middleware/auth.js';
import { getDbPool } from '../../../../shared/db.js';
import { logger } from '../../../../shared/logger.js';

const notifLogger = logger.child({ component: 'notifications' });

const registerTokenSchema = z.object({
  token: z.string().min(1).max(512),
  platform: z.enum(['android', 'ios', 'web']),
});

const notificationsRouter = Router();

/**
 * POST /v1/notifications/register-token
 * Register a push notification token for the current device.
 */
notificationsRouter.post('/register-token', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const deviceId = req.deviceId!;
    const body = registerTokenSchema.parse(req.body);

    const pool = getDbPool();

    // Upsert push token on the devices table
    await pool.query(
      `UPDATE devices
       SET push_token = $1, push_platform = $2, last_seen_at = NOW()
       WHERE id = $3 AND user_id = $4`,
      [body.token, body.platform, deviceId, userId],
    );

    notifLogger.info({ userId, deviceId, platform: body.platform }, 'Push token registered');

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /v1/notifications/token
 * Unregister the push token for the current device.
 */
notificationsRouter.delete('/token', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const deviceId = req.deviceId!;

    const pool = getDbPool();

    await pool.query(
      `UPDATE devices
       SET push_token = NULL, push_platform = NULL
       WHERE id = $1 AND user_id = $2`,
      [deviceId, userId],
    );

    notifLogger.info({ userId, deviceId }, 'Push token unregistered');

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/notifications/settings
 * Get notification preferences for the current user.
 */
notificationsRouter.get('/settings', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const pool = getDbPool();

    const { rows } = await pool.query(
      `SELECT push_enabled, sound_enabled, vibrate_enabled, preview_enabled
       FROM notification_preferences WHERE user_id = $1`,
      [userId],
    );

    if (rows.length === 0) {
      // Return defaults
      res.json({
        pushEnabled: true,
        soundEnabled: true,
        vibrateEnabled: true,
        previewEnabled: true,
      });
      return;
    }

    const prefs = rows[0];
    res.json({
      pushEnabled: prefs.push_enabled,
      soundEnabled: prefs.sound_enabled,
      vibrateEnabled: prefs.vibrate_enabled,
      previewEnabled: prefs.preview_enabled,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /v1/notifications/settings
 * Update notification preferences.
 */
notificationsRouter.patch('/settings', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const pool = getDbPool();

    const settingsSchema = z.object({
      pushEnabled: z.boolean().optional(),
      soundEnabled: z.boolean().optional(),
      vibrateEnabled: z.boolean().optional(),
      previewEnabled: z.boolean().optional(),
    });

    const body = settingsSchema.parse(req.body);

    await pool.query(
      `INSERT INTO notification_preferences (user_id, push_enabled, sound_enabled, vibrate_enabled, preview_enabled)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         push_enabled = COALESCE($2, notification_preferences.push_enabled),
         sound_enabled = COALESCE($3, notification_preferences.sound_enabled),
         vibrate_enabled = COALESCE($4, notification_preferences.vibrate_enabled),
         preview_enabled = COALESCE($5, notification_preferences.preview_enabled),
         updated_at = NOW()`,
      [
        userId,
        body.pushEnabled ?? true,
        body.soundEnabled ?? true,
        body.vibrateEnabled ?? true,
        body.previewEnabled ?? true,
      ],
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export { notificationsRouter };
