import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../../../middleware/auth.js';
import { getDbPool } from '../../../../shared/db.js';

const foldersRouter = Router();

const createFolderSchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().max(20).optional(),
  chatIds: z.array(z.string().uuid()).optional(),
  filterUnread: z.boolean().default(false),
  filterMuted: z.boolean().default(false),
});

const updateFolderSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().max(20).optional(),
  filterUnread: z.boolean().optional(),
  filterMuted: z.boolean().optional(),
});

/**
 * GET /v1/folders
 * List user's chat folders.
 */
foldersRouter.get('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const pool = getDbPool();

    const { rows: folders } = await pool.query(
      `SELECT f.id, f.name, f.icon, f.sort_order as "sortOrder",
              f.filter_unread as "filterUnread", f.filter_muted as "filterMuted",
              COALESCE(json_agg(fi.chat_id) FILTER (WHERE fi.chat_id IS NOT NULL), '[]') as "chatIds"
       FROM chat_folders f
       LEFT JOIN chat_folder_items fi ON fi.folder_id = f.id
       WHERE f.user_id = $1
       GROUP BY f.id
       ORDER BY f.sort_order`,
      [userId],
    );

    res.json({ data: folders });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/folders
 * Create a chat folder.
 */
foldersRouter.post('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = createFolderSchema.parse(req.body);
    const pool = getDbPool();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get next sort_order
      const { rows: [{ max }] } = await client.query(
        `SELECT COALESCE(MAX(sort_order), -1) as max FROM chat_folders WHERE user_id = $1`,
        [userId],
      );

      const { rows: [folder] } = await client.query(
        `INSERT INTO chat_folders (user_id, name, icon, sort_order, filter_unread, filter_muted)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [userId, body.name, body.icon || null, max + 1, body.filterUnread, body.filterMuted],
      );

      // Add chats to folder
      if (body.chatIds && body.chatIds.length > 0) {
        for (const chatId of body.chatIds) {
          await client.query(
            `INSERT INTO chat_folder_items (folder_id, chat_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [folder.id, chatId],
          );
        }
      }

      await client.query('COMMIT');
      res.status(201).json({ id: folder.id, name: body.name });
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
 * PATCH /v1/folders/:folderId
 * Update a folder.
 */
foldersRouter.patch('/:folderId', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const folderId = req.params['folderId'] as string;
    const body = updateFolderSchema.parse(req.body);
    const pool = getDbPool();

    const updates: string[] = [];
    const params: unknown[] = [folderId, userId];
    let idx = 3;

    if (body.name !== undefined) { updates.push(`name = $${idx++}`); params.push(body.name); }
    if (body.icon !== undefined) { updates.push(`icon = $${idx++}`); params.push(body.icon); }
    if (body.filterUnread !== undefined) { updates.push(`filter_unread = $${idx++}`); params.push(body.filterUnread); }
    if (body.filterMuted !== undefined) { updates.push(`filter_muted = $${idx++}`); params.push(body.filterMuted); }

    if (updates.length > 0) {
      await pool.query(
        `UPDATE chat_folders SET ${updates.join(', ')} WHERE id = $1 AND user_id = $2`,
        params,
      );
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /v1/folders/:folderId
 * Delete a folder.
 */
foldersRouter.delete('/:folderId', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const folderId = req.params['folderId'] as string;
    const pool = getDbPool();

    await pool.query(
      `DELETE FROM chat_folders WHERE id = $1 AND user_id = $2`,
      [folderId, userId],
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/folders/:folderId/chats/:chatId
 * Add a chat to a folder.
 */
foldersRouter.post('/:folderId/chats/:chatId', authMiddleware, async (req, res, next) => {
  try {
    const folderId = req.params['folderId'] as string;
    const chatId = req.params['chatId'] as string;
    const pool = getDbPool();

    await pool.query(
      `INSERT INTO chat_folder_items (folder_id, chat_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [folderId, chatId],
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /v1/folders/:folderId/chats/:chatId
 * Remove a chat from a folder.
 */
foldersRouter.delete('/:folderId/chats/:chatId', authMiddleware, async (req, res, next) => {
  try {
    const folderId = req.params['folderId'] as string;
    const chatId = req.params['chatId'] as string;
    const pool = getDbPool();

    await pool.query(
      `DELETE FROM chat_folder_items WHERE folder_id = $1 AND chat_id = $2`,
      [folderId, chatId],
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export { foldersRouter };
