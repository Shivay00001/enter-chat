import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../../../middleware/auth.js';
import { getDbPool } from '../../../../shared/db.js';
import { PostgresMessageRepository } from '../../../chats/adapters/postgres.js';
import { sendMessageNotification } from '../../../../services/push-notifications.js';

const messagesRouter = Router();

const sendMessageSchema = z.object({
  clientMessageId: z.string().uuid().optional(), // Used for idempotency
  msgType: z.enum(['text', 'image', 'video', 'audio', 'file', 'location', 'sticker', 'voice_note']),
  content: z.string().max(10000),
  replyToId: z.string().uuid().optional(),
  forwardFromId: z.string().uuid().optional(),
  mediaUrl: z.string().url().optional(),
  mediaMetadata: z.record(z.unknown()).optional(),
});

const editMessageSchema = z.object({
  content: z.string().min(1).max(10000),
});

const reactMessageSchema = z.object({
  emoji: z.string().min(1).max(8),
});

function getMessageRepo() {
  return new PostgresMessageRepository(getDbPool());
}

/**
 * POST /v1/chats/:chatId/messages
 * Send a new message to a chat
 */
messagesRouter.post('/:chatId/messages', authMiddleware, async (req, res, next) => {
  try {
    const body = sendMessageSchema.parse(req.body);
    const userId = req.userId!;
    const chatId = req.params['chatId'] as string;

    const repo = getMessageRepo();
    
    // Save to DB
    const message = await repo.createMessage({
      chatId,
      senderId: userId,
      content: body.content,
      msgType: body.msgType,
      replyToId: body.replyToId,
      forwardFromId: body.forwardFromId,
      mediaUrl: body.mediaUrl,
      mediaMetadata: body.mediaMetadata,
    });

    const pool = getDbPool();
    // Get chat members for push notifications
    const { rows: members } = await pool.query(
      `SELECT user_id FROM chat_members WHERE chat_id = $1 AND state = 'active'`,
      [chatId]
    );
    const memberUserIds = members.map((m: any) => m.user_id);

    // Send push notification (background)
    const otherMembers = memberUserIds.filter((id: string) => id !== userId);
    for (const memberId of otherMembers) {
      sendMessageNotification(memberId, message!.senderName, message!.content, chatId, message!.id)
        .catch((err) => console.error('Failed to send push', err));
    }

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/chats/:chatId/messages
 * Get paginated messages for a chat
 */
messagesRouter.get('/:chatId/messages', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const chatId = req.params['chatId'] as string;
    const limit = Math.min(parseInt(req.query['limit'] as string) || 50, 100);
    const before = req.query['before'] as string | undefined;
    const after = req.query['after'] as string | undefined;

    const repo = getMessageRepo();
    const result = await repo.getMessages(chatId, userId, { limit, before, after });
    
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/chats/:chatId/messages/search
 * Search messages within a chat
 */
messagesRouter.get('/:chatId/messages/search', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const chatId = req.params['chatId'] as string;
    const query = req.query['q'] as string;
    
    if (!query) {
      res.json([]);
      return;
    }

    const repo = getMessageRepo();
    const results = await repo.searchMessages(chatId, userId, query);
    
    res.json(results);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /v1/messages/:messageId
 * Edit a message
 */
messagesRouter.patch('/:messageId', authMiddleware, async (req, res, next) => {
  try {
    const body = editMessageSchema.parse(req.body);
    const userId = req.userId!;
    const messageId = req.params['messageId'] as string;

    const repo = getMessageRepo();
    const updated = await repo.editMessage(messageId, userId, body.content);
    
    // Supabase Postgres CDC automatically broadcasts the edit.

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /v1/messages/:messageId
 * Delete a message (soft delete)
 */
messagesRouter.delete('/:messageId', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const messageId = req.params['messageId'] as string;
    const forEveryone = req.query['everyone'] === 'true';

    const repo = getMessageRepo();
    // Need chat ID before delete for broadcast
    const msg = await repo.getMessageById(messageId);
    if (!msg) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    await repo.deleteMessage(messageId, userId, forEveryone);
    
    // Supabase Postgres CDC automatically broadcasts the delete.

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/messages/:messageId/reactions
 * React to a message
 */
messagesRouter.post('/:messageId/reactions', authMiddleware, async (req, res, next) => {
  try {
    const body = reactMessageSchema.parse(req.body);
    const userId = req.userId!;
    const messageId = req.params['messageId'] as string;

    const repo = getMessageRepo();
    await repo.addReaction(messageId, userId, body.emoji);
    
    const msg = await repo.getMessageById(messageId);
    if (msg) {
    // Supabase Postgres CDC automatically broadcasts the reaction.
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export { messagesRouter };
