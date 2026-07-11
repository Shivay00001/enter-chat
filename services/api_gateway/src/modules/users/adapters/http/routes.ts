import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../../../middleware/auth.js';
import { getDbPool } from '../../../../shared/db.js';

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/).optional(),
  statusText: z.string().max(500).optional(),
});

const syncContactsSchema = z.object({
  phoneHashes: z.array(z.string()).max(500), // Base64 encoded phone hashes
});

const usersRouter = Router();

/**
 * GET /v1/users/me
 * Get current authenticated user's profile.
 */
usersRouter.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT id, username, display_name as "displayName", avatar_media_id as "avatarUrl", status_text as "statusText", account_state as "accountState"
       FROM users WHERE id = $1`,
      [userId]
    );

    if (!rows[0]) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /v1/users/me/profile
 * Update current user's profile.
 */
usersRouter.patch('/me/profile', authMiddleware, async (req, res, next) => {
  try {
    const body = updateProfileSchema.parse(req.body);
    const userId = req.userId!;
    const pool = getDbPool();

    // Dynamically build the update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (body.displayName !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      values.push(body.displayName);
    }
    if (body.username !== undefined) {
      updates.push(`username = $${paramIndex++}`);
      values.push(body.username);
    }
    if (body.statusText !== undefined) {
      updates.push(`status_text = $${paramIndex++}`);
      values.push(body.statusText);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(userId);
    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, username, display_name as "displayName", avatar_media_id as "avatarUrl", status_text as "statusText"`,
      values
    );

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/users/sync-contacts
 * Find which of the user's phone contacts are on EnterChat.
 */
usersRouter.post('/sync-contacts', authMiddleware, async (req, res, next) => {
  try {
    const body = syncContactsSchema.parse(req.body);
    if (body.phoneHashes.length === 0) {
      res.json({ matches: [] });
      return;
    }

    // Convert base64 strings to Buffer arrays
    const buffers = body.phoneHashes.map(hash => Buffer.from(hash, 'base64'));

    const pool = getDbPool();
    // Using Postgres ANY($1::bytea[])
    const { rows } = await pool.query(
      `SELECT id, username, display_name as "displayName", avatar_media_id as "avatarUrl", status_text as "statusText", phone_hash
       FROM users 
       WHERE account_state = 'active' AND phone_hash = ANY($1::bytea[])`,
      [buffers]
    );

    const matches = rows.map(r => ({
      ...r,
      phoneHash: r.phone_hash.toString('base64'),
    }));

    res.json({ matches });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/users/search?query=
 * Search users by username.
 */
usersRouter.get('/search', authMiddleware, async (req, res, next) => {
  try {
    const query = (req.query['query'] as string || '').toLowerCase().trim();
    if (!query || query.length < 2) {
      res.json({ data: [], cursor: null, hasMore: false });
      return;
    }

    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT id, username, display_name as "displayName", avatar_media_id as "avatarUrl"
       FROM users 
       WHERE account_state = 'active' 
       AND (username ILIKE $1 OR display_name ILIKE $1)
       LIMIT 20`,
      [`%${query}%`]
    );

    res.json({ data: rows, cursor: null, hasMore: false });
  } catch (err) {
    next(err);
  }
});

export { usersRouter };
