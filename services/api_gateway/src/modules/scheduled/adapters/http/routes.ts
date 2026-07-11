import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../../../middleware/auth.js';
import { getDbPool } from '../../../../shared/db.js';

const scheduledRouter = Router();

const scheduleMessageSchema = z.object({
  chatId: z.string().uuid(),
  content: z.string().min(1).max(10000),
  messageType: z.enum(['text', 'image', 'video', 'audio', 'document']).default('text'),
  mediaUrl: z.string().url().optional(),
  scheduledFor: z.string().datetime(),
});

/**
 * GET /v1/scheduled
 * List user's scheduled messages.
 */
scheduledRouter.get('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const pool = getDbPool();

    const { rows } = await pool.query(
      `SELECT sm.id, sm.chat_id as "chatId", sm.content,
              sm.message_type as "messageType", sm.media_url as "mediaUrl",
              sm.scheduled_for as "scheduledFor", sm.created_at as "createdAt"
       FROM scheduled_messages sm
       WHERE sm.sender_id = $1 AND sm.sent_at IS NULL AND sm.cancelled_at IS NULL
       ORDER BY sm.scheduled_for ASC`,
      [userId],
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/scheduled
 * Schedule a message for future delivery.
 */
scheduledRouter.post('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = scheduleMessageSchema.parse(req.body);

    const scheduledDate = new Date(body.scheduledFor);
    if (scheduledDate <= new Date()) {
      res.status(400).json({ error: { code: 'PAST_DATE', message: 'Scheduled time must be in the future' } });
      return;
    }

    const pool = getDbPool();
    const { rows: [msg] } = await pool.query(
      `INSERT INTO scheduled_messages (chat_id, sender_id, content, message_type, media_url, scheduled_for)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, scheduled_for as "scheduledFor", created_at as "createdAt"`,
      [body.chatId, userId, body.content, body.messageType, body.mediaUrl || null, body.scheduledFor],
    );

    res.status(201).json({
      id: msg.id,
      chatId: body.chatId,
      content: body.content,
      scheduledFor: msg.scheduledFor,
      createdAt: msg.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /v1/scheduled/:messageId
 * Update a scheduled message (content or time).
 */
scheduledRouter.patch('/:messageId', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const messageId = req.params['messageId'] as string;
    const body = z.object({
      content: z.string().min(1).max(10000).optional(),
      scheduledFor: z.string().datetime().optional(),
    }).parse(req.body);

    const pool = getDbPool();
    const updates: string[] = [];
    const params: unknown[] = [messageId, userId];
    let idx = 3;

    if (body.content) { updates.push(`content = $${idx++}`); params.push(body.content); }
    if (body.scheduledFor) { updates.push(`scheduled_for = $${idx++}`); params.push(body.scheduledFor); }

    if (updates.length > 0) {
      await pool.query(
        `UPDATE scheduled_messages SET ${updates.join(', ')}
         WHERE id = $1 AND sender_id = $2 AND sent_at IS NULL AND cancelled_at IS NULL`,
        params,
      );
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /v1/scheduled/:messageId
 * Cancel a scheduled message.
 */
scheduledRouter.delete('/:messageId', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const messageId = req.params['messageId'] as string;
    const pool = getDbPool();

    await pool.query(
      `UPDATE scheduled_messages SET cancelled_at = NOW()
       WHERE id = $1 AND sender_id = $2 AND sent_at IS NULL`,
      [messageId, userId],
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export { scheduledRouter };
