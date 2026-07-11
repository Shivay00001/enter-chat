import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../../../middleware/auth.js';
import { getDbPool } from '../../../../shared/db.js';

const presenceRouter = Router();

const updatePresenceSchema = z.object({
  showLastSeen: z.boolean().optional(),
  showOnline: z.boolean().optional(),
});

/**
 * GET /v1/presence/:userId
 * Get a user's online status and last seen time.
 * Respects privacy settings — if user hides last_seen, returns null.
 */
presenceRouter.get('/:userId', authMiddleware, async (req, res, next) => {
  try {
    const requesterId = req.userId!;
    const targetId = req.params['userId'] as string;
    const pool = getDbPool();

    // Check if blocked
    const { rows: blocked } = await pool.query(
      `SELECT 1 FROM blocked_users
       WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
      [requesterId, targetId],
    );

    if (blocked.length > 0) {
      res.json({ userId: targetId, isOnline: false, lastSeenAt: null });
      return;
    }

    const { rows: [user] } = await pool.query(
      `SELECT is_online as "isOnline", last_seen_at as "lastSeenAt", show_last_seen as "showLastSeen"
       FROM users WHERE id = $1`,
      [targetId],
    );

    if (!user) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    res.json({
      userId: targetId,
      isOnline: user.isOnline || false,
      lastSeenAt: user.showLastSeen ? user.lastSeenAt : null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /v1/presence/settings
 * Update privacy settings for presence.
 */
presenceRouter.patch('/settings', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = updatePresenceSchema.parse(req.body);
    const pool = getDbPool();

    const updates: string[] = [];
    const params: unknown[] = [userId];
    let paramIdx = 2;

    if (body.showLastSeen !== undefined) {
      updates.push(`show_last_seen = $${paramIdx++}`);
      params.push(body.showLastSeen);
    }

    if (updates.length > 0) {
      await pool.query(
        `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1`,
        params,
      );
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/presence/heartbeat
 * Called periodically by the app to update online status.
 * Also called by WebSocket connect/disconnect.
 */
presenceRouter.post('/heartbeat', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const pool = getDbPool();

    await pool.query(
      `UPDATE users SET is_online = TRUE, last_seen_at = NOW() WHERE id = $1`,
      [userId],
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export { presenceRouter };
