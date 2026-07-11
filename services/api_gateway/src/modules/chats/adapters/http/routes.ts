import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../../../middleware/auth.js';
import { getDbPool } from '../../../../shared/db.js';
import { PostgresChatRepository } from '../postgres.js';
import { BadRequestError } from '../../../../shared/errors.js';

const chatsRouter = Router();

const createDirectChatSchema = z.object({
  recipientUserId: z.string().uuid(),
});

const createGroupSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  memberUserIds: z.array(z.string().uuid()).min(1).max(256),
});

const updateChatSchema = z.object({
  title: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
});

// Helper to get repo instance per request (can be optimized with DI container later)
function getChatRepo() {
  return new PostgresChatRepository(getDbPool());
}

/**
 * GET /v1/chats
 * List user's chats
 */
chatsRouter.get('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const repo = getChatRepo();
    const chats = await repo.getChatsByUserId(userId);
    res.json({ data: chats });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/chats/:chatId
 * Get chat details
 */
chatsRouter.get('/:chatId', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const chatId = req.params['chatId'] as string;
    const repo = getChatRepo();
    const chat = await repo.getChatById(chatId, userId);
    
    if (!chat) {
      res.status(404).json({ error: 'Chat not found or access denied' });
      return;
    }
    
    const members = await repo.getChatMembers(chatId);
    res.json({ ...chat, members });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/chats/direct
 * Create direct chat
 */
chatsRouter.post('/direct', authMiddleware, async (req, res, next) => {
  try {
    const body = createDirectChatSchema.parse(req.body);
    const userId = req.userId!;
    
    if (body.recipientUserId === userId) {
      throw new BadRequestError('Cannot create chat with yourself');
    }

    const repo = getChatRepo();
    // In production, should check if direct chat already exists first.
    // For MVP, letting createChat handle it (might create dupes without unique constraint)
    const chat = await repo.createChat({
      creatorId: userId,
      chatType: 'direct',
      memberUserIds: [body.recipientUserId]
    });
    
    res.status(201).json(chat);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/chats/group
 * Create group chat
 */
chatsRouter.post('/group', authMiddleware, async (req, res, next) => {
  try {
    const body = createGroupSchema.parse(req.body);
    const userId = req.userId!;
    
    const repo = getChatRepo();
    const chat = await repo.createChat({
      creatorId: userId,
      chatType: 'group',
      title: body.title,
      description: body.description,
      memberUserIds: body.memberUserIds,
    });
    
    res.status(201).json(chat);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /v1/chats/:chatId
 * Update chat details
 */
chatsRouter.patch('/:chatId', authMiddleware, async (req, res, next) => {
  try {
    const body = updateChatSchema.parse(req.body);
    const userId = req.userId!;
    const chatId = req.params['chatId'] as string;
    
    const repo = getChatRepo();
    const updated = await repo.updateChat(chatId, userId, body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /v1/chats/:chatId
 * Delete chat
 */
chatsRouter.delete('/:chatId', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const chatId = req.params['chatId'] as string;
    const repo = getChatRepo();
    await repo.deleteChat(chatId, userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/chats/:chatId/members/:memberId
 * Add member to chat
 */
chatsRouter.post('/:chatId/members/:memberId', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const chatId = req.params['chatId'] as string;
    const memberId = req.params['memberId'] as string;
    const repo = getChatRepo();
    await repo.addMember(chatId, memberId, userId);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /v1/chats/:chatId/members/:memberId
 * Remove member / leave chat
 */
chatsRouter.delete('/:chatId/members/:memberId', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const chatId = req.params['chatId'] as string;
    const memberId = req.params['memberId'] as string;
    const repo = getChatRepo();
    
    if (userId === memberId) {
      await repo.leaveChat(chatId, userId);
    } else {
      await repo.removeMember(chatId, memberId, userId);
    }
    
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/chats/:chatId/read
 * Mark chat as read
 */
chatsRouter.post('/:chatId/read', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const chatId = req.params['chatId'] as string;
    const repo = getChatRepo();
    await repo.markAsRead(chatId, userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export { chatsRouter };
