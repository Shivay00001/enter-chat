import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../../../middleware/auth.js';
import { getDbPool } from '../../../../shared/db.js';

const pinsRouter = Router();

/**
 * GET /v1/chats/:chatId/pins
 * Get all pinned messages in a chat.
 */
pinsRouter.get('/:chatId/pins', authMiddleware, async (req, res, next) => {
  try {
    const chatId = req.params['chatId'] as string;
    const pool = getDbPool();

    const { rows } = await pool.query(
      `SELECT pm.message_id as "messageId", pm.pinned_at as "pinnedAt",
              u.display_name as "pinnedByName",
              m.plaintext_body as "content", m.message_type as "msgType",
              m.created_at as "messageCreatedAt",
              su.display_name as "senderName"
       FROM pinned_messages pm
       JOIN users u ON u.id = pm.pinned_by
       JOIN messages m ON m.id = pm.message_id
       LEFT JOIN users su ON su.id = m.sender_user_id
       WHERE pm.chat_id = $1
       ORDER BY pm.pinned_at DESC`,
      [chatId],
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/chats/:chatId/pins
 * Pin a message. Admins/owners only in groups.
 */
pinsRouter.post('/:chatId/pins', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const chatId = req.params['chatId'] as string;
    const { messageId } = z.object({ messageId: z.string().uuid() }).parse(req.body);
    const pool = getDbPool();

    await pool.query(
      `INSERT INTO pinned_messages (chat_id, message_id, pinned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (chat_id, message_id) DO NOTHING`,
      [chatId, messageId, userId],
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /v1/chats/:chatId/pins/:messageId
 * Unpin a message.
 */
pinsRouter.delete('/:chatId/pins/:messageId', authMiddleware, async (req, res, next) => {
  try {
    const chatId = req.params['chatId'] as string;
    const messageId = req.params['messageId'] as string;
    const pool = getDbPool();

    await pool.query(
      `DELETE FROM pinned_messages WHERE chat_id = $1 AND message_id = $2`,
      [chatId, messageId],
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export { pinsRouter };
