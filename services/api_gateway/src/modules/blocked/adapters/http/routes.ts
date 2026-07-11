import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../../../middleware/auth.js';
import { getDbPool } from '../../../../shared/db.js';

const blockedRouter = Router();

const blockUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.enum(['spam', 'harassment', 'other']).optional(),
});

/**
 * GET /v1/blocked
 * List all blocked users.
 */
blockedRouter.get('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT b.blocked_id as "userId", b.reason, b.blocked_at as "blockedAt",
              u.display_name as "displayName", u.username, u.avatar_media_id as "avatarMediaId"
       FROM blocked_users b
       JOIN users u ON u.id = b.blocked_id
       WHERE b.blocker_id = $1
       ORDER BY b.blocked_at DESC`,
      [userId],
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/blocked
 * Block a user. Blocks messages, calls, stories, and online status visibility.
 */
blockedRouter.post('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = blockUserSchema.parse(req.body);

    if (body.userId === userId) {
      res.status(400).json({ error: { code: 'CANNOT_BLOCK_SELF', message: 'Cannot block yourself' } });
      return;
    }

    const pool = getDbPool();
    await pool.query(
      `INSERT INTO blocked_users (blocker_id, blocked_id, reason)
       VALUES ($1, $2, $3)
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [userId, body.userId, body.reason || null],
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /v1/blocked/:userId
 * Unblock a user.
 */
blockedRouter.delete('/:userId', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const blockedId = req.params['userId'] as string;
    const pool = getDbPool();

    await pool.query(
      `DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2`,
      [userId, blockedId],
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/blocked/check/:userId
 * Check if a user is blocked (used by message send flow).
 */
blockedRouter.get('/check/:userId', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const targetId = req.params['userId'] as string;
    const pool = getDbPool();

    const { rows } = await pool.query(
      `SELECT 1 FROM blocked_users
       WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
      [userId, targetId],
    );

    res.json({ blocked: rows.length > 0 });
  } catch (err) {
    next(err);
  }
});

export { blockedRouter };
