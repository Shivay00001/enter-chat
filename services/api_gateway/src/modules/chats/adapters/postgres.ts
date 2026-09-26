import type { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../shared/logger.js';

const chatLogger = logger.child({ component: 'chat-repo' });

/**
 * PostgreSQL Chat & Message Repository — PRODUCTION.
 * Fully functional CRUD: create, read, update, delete.
 * No mock data. Everything from the database.
 *
 * Aligned to infra/migrations/*.sql (see docs/schema-trd.md):
 *   chats.type (chat_type enum), chat_members.state (member_state enum, composite PK),
 *   messages partitioned with sender_user_id / message_type / plaintext_body / state.
 */

// --- CHAT REPOSITORY ---

// Map the API-level chat type to the migration chat_type enum.
function toDbChatType(chatType: 'direct' | 'group' | 'channel' | 'community'): string {
  return chatType === 'community' ? 'community_room' : chatType;
}

// Map the API-level message type to the migration message_type enum.
function toDbMessageType(msgType: string): string {
  switch (msgType) {
    case 'voice_note': return 'voice';
    case 'file': return 'document';
    default: return msgType;
  }
}

export class PostgresChatRepository {
  constructor(private readonly pool: Pool) {}

  /** Create a new 1:1 or group chat */
  async createChat(data: {
    creatorId: string;
    chatType: 'direct' | 'group' | 'channel' | 'community';
    title?: string;
    description?: string;
    avatarUrl?: string;
    memberUserIds: string[];
  }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const chatId = uuidv4();
      await client.query(
        `INSERT INTO chats (id, type, title, description, avatar_media_id, created_by, created_at)
         VALUES ($1, $2::chat_type, $3, $4, $5, $6, NOW())`,
        [chatId, toDbChatType(data.chatType), data.title || null, data.description || null,
         data.avatarUrl || null, data.creatorId],
      );

      // Add all members including creator
      const allMembers = new Set([data.creatorId, ...data.memberUserIds]);
      for (const userId of allMembers) {
        const role = userId === data.creatorId ? 'owner' : 'member';
        await client.query(
          `INSERT INTO chat_members (chat_id, user_id, role, state, joined_at)
           VALUES ($1, $2, $3, 'active', NOW())
           ON CONFLICT (chat_id, user_id) DO UPDATE SET state = 'active', joined_at = NOW()`,
          [chatId, userId, role],
        );
      }

      await client.query('COMMIT');
      chatLogger.info({ chatId, chatType: data.chatType, memberCount: allMembers.size }, 'Chat created');
      return { id: chatId, chatType: data.chatType, title: data.title };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Get all chats for a user with last message preview */
  async getChatsByUserId(userId: string) {
    const { rows } = await this.pool.query(
      `SELECT
        c.id, c.type as "chatType", c.title, c.description, c.avatar_media_id as "avatarUrl",
        c.created_at as "createdAt",
        -- Last message info
        m.plaintext_body as "lastMessageContent", m.sender_user_id as "lastMessageSenderId",
        m.created_at as "lastMessageAt", m.message_type as "lastMessageType",
        -- Sender display name
        u.display_name as "lastMessageSenderName",
        -- Unread count
        COALESCE(
          (SELECT COUNT(*) FROM messages msg
           WHERE msg.chat_id = c.id
           AND msg.created_at > COALESCE(cm.last_read_at, cm.joined_at)
           AND msg.sender_user_id != $1),
          0
        )::int as "unreadCount",
        -- For direct chats: get the other user's name and avatar
        CASE WHEN c.type = 'direct' THEN
          (SELECT ou.display_name FROM chat_members ocm
           JOIN users ou ON ou.id = ocm.user_id
           WHERE ocm.chat_id = c.id AND ocm.user_id != $1 AND ocm.state = 'active' LIMIT 1)
        END as "directPartnerName",
        CASE WHEN c.type = 'direct' THEN
          (SELECT ou.avatar_media_id FROM chat_members ocm
           JOIN users ou ON ou.id = ocm.user_id
           WHERE ocm.chat_id = c.id AND ocm.user_id != $1 AND ocm.state = 'active' LIMIT 1)
        END as "directPartnerAvatar"
      FROM chat_members cm
      JOIN chats c ON c.id = cm.chat_id
      LEFT JOIN LATERAL (
        SELECT plaintext_body, sender_user_id, created_at, message_type
        FROM messages
        WHERE chat_id = c.id AND deleted_at IS NULL
        ORDER BY created_at DESC LIMIT 1
      ) m ON true
      LEFT JOIN users u ON u.id = m.sender_user_id
      WHERE cm.user_id = $1 AND cm.state = 'active' AND c.archived_at IS NULL
      ORDER BY COALESCE(m.created_at, c.created_at) DESC`,
      [userId],
    );
    return rows;
  }

  /** Get chat by ID with membership check */
  async getChatById(chatId: string, userId: string) {
    const { rows } = await this.pool.query(
      `SELECT c.id, c.type as "chatType", c.title, c.description,
              c.avatar_media_id as "avatarUrl",
              c.created_by as "createdBy", c.created_at as "createdAt",
              cm.role as "myRole"
       FROM chats c
       JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = $2
       WHERE c.id = $1 AND cm.state = 'active' AND c.archived_at IS NULL`,
      [chatId, userId],
    );
    return rows[0] || null;
  }

  /** Get members of a chat */
  async getChatMembers(chatId: string) {
    const { rows } = await this.pool.query(
      `SELECT cm.user_id as "userId", cm.role, cm.joined_at as "joinedAt",
              u.display_name as "displayName", u.avatar_media_id as "avatarUrl",
              u.status_text as "statusText"
       FROM chat_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.chat_id = $1 AND cm.state = 'active'
       ORDER BY cm.role = 'owner' DESC, cm.joined_at ASC`,
      [chatId],
    );
    return rows;
  }

  /** Update chat (title, description, avatar) */
  async updateChat(chatId: string, userId: string, data: { title?: string; description?: string; avatarUrl?: string }) {
    // Verify user is owner/admin
    const { rows: perm } = await this.pool.query(
      `SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2 AND state = 'active'`,
      [chatId, userId],
    );
    if (!perm[0] || !['owner', 'admin'].includes(perm[0].role)) {
      throw new Error('FORBIDDEN: Only owner/admin can update chat');
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.title !== undefined) { updates.push(`title = $${idx++}`); values.push(data.title); }
    if (data.description !== undefined) { updates.push(`description = $${idx++}`); values.push(data.description); }
    if (data.avatarUrl !== undefined) { updates.push(`avatar_media_id = $${idx++}`); values.push(data.avatarUrl); }

    if (updates.length > 0) {
      values.push(chatId);
      await this.pool.query(
        `UPDATE chats SET ${updates.join(', ')} WHERE id = $${idx}`,
        values,
      );
    }

    return this.getChatById(chatId, userId);
  }

  /** Delete a chat (soft delete via archived_at) */
  async deleteChat(chatId: string, userId: string) {
    const { rows: perm } = await this.pool.query(
      `SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2 AND state = 'active'`,
      [chatId, userId],
    );
    if (!perm[0] || perm[0].role !== 'owner') {
      throw new Error('FORBIDDEN: Only owner can delete chat');
    }

    await this.pool.query(
      `UPDATE chats SET archived_at = NOW() WHERE id = $1`,
      [chatId],
    );
  }

  /** Leave a chat */
  async leaveChat(chatId: string, userId: string) {
    await this.pool.query(
      `UPDATE chat_members SET state = 'left'
       WHERE chat_id = $1 AND user_id = $2 AND state = 'active'`,
      [chatId, userId],
    );
  }

  /** Add member to a chat */
  async addMember(chatId: string, userId: string, addedByUserId: string) {
    const { rows: perm } = await this.pool.query(
      `SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2 AND state = 'active'`,
      [chatId, addedByUserId],
    );
    if (!perm[0] || !['owner', 'admin'].includes(perm[0].role)) {
      throw new Error('FORBIDDEN: Only owner/admin can add members');
    }

    await this.pool.query(
      `INSERT INTO chat_members (chat_id, user_id, role, state, joined_at)
       VALUES ($1, $2, 'member', 'active', NOW())
       ON CONFLICT (chat_id, user_id) DO UPDATE SET state = 'active', joined_at = NOW()`,
      [chatId, userId],
    );
  }

  /** Remove member from a chat */
  async removeMember(chatId: string, userId: string, removedByUserId: string) {
    const { rows: perm } = await this.pool.query(
      `SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2 AND state = 'active'`,
      [chatId, removedByUserId],
    );
    if (!perm[0] || !['owner', 'admin'].includes(perm[0].role)) {
      throw new Error('FORBIDDEN: Only owner/admin can remove members');
    }

    await this.pool.query(
      `UPDATE chat_members SET state = 'left'
       WHERE chat_id = $1 AND user_id = $2 AND state = 'active'`,
      [chatId, userId],
    );
  }

  /** Get member user IDs for a chat (for broadcast) */
  async getMemberUserIds(chatId: string): Promise<string[]> {
    const { rows } = await this.pool.query(
      `SELECT user_id FROM chat_members WHERE chat_id = $1 AND state = 'active'`,
      [chatId],
    );
    return rows.map(r => r.user_id);
  }

  /** Mark messages as read */
  async markAsRead(chatId: string, userId: string) {
    await this.pool.query(
      `UPDATE chat_members SET last_read_at = NOW() WHERE chat_id = $1 AND user_id = $2`,
      [chatId, userId],
    );
  }
}

// --- MESSAGE REPOSITORY ---

export class PostgresMessageRepository {
  constructor(private readonly pool: Pool) {}

  /** Send a new message */
  async createMessage(data: {
    chatId: string;
    senderId: string;
    content: string;
    msgType: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker' | 'voice_note';
    replyToId?: string;
    forwardFromId?: string;
    mediaUrl?: string;
    mediaMetadata?: Record<string, unknown>;
    idempotencyKey?: string;
  }) {
    const messageId = uuidv4();

    // Verify sender is a member of the chat
    const { rows: membership } = await this.pool.query(
      `SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2 AND state = 'active'`,
      [data.chatId, data.senderId],
    );
    if (!membership[0]) {
      throw new Error('FORBIDDEN: Not a member of this chat');
    }

    await this.pool.query(
      `INSERT INTO messages (id, chat_id, sender_user_id, message_type, plaintext_body,
                             reply_to_message_id, forward_from_message_id,
                             media_url, media_metadata, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4::message_type, $5, $6, $7, $8, $9, $10, NOW())`,
      [messageId, data.chatId, data.senderId, toDbMessageType(data.msgType), data.content,
       data.replyToId || null, data.forwardFromId || null, data.mediaUrl || null,
       data.mediaMetadata ? JSON.stringify(data.mediaMetadata) : null,
       data.idempotencyKey || uuidv4()],
    );

    // Fetch and return the full message
    return this.getMessageById(messageId);
  }

  /** Get messages for a chat (paginated, cursor-based) */
  async getMessages(chatId: string, userId: string, options: {
    limit?: number;
    before?: string; // cursor: message ID
    after?: string;
  } = {}) {
    const limit = Math.min(options.limit || 50, 100);
    const params: unknown[] = [chatId, userId];
    let cursorClause = '';

    if (options.before) {
      cursorClause = `AND m.created_at < (SELECT created_at FROM messages WHERE id = $3)`;
      params.push(options.before);
    } else if (options.after) {
      cursorClause = `AND m.created_at > (SELECT created_at FROM messages WHERE id = $3)`;
      params.push(options.after);
    }

    params.push(limit);

    const { rows } = await this.pool.query(
      `SELECT m.id, m.chat_id as "chatId", m.sender_user_id as "senderId", m.plaintext_body as "content",
              m.message_type as "msgType", m.reply_to_message_id as "replyToId",
              m.forward_from_message_id as "forwardFromId",
              m.media_url as "mediaUrl", m.media_metadata as "mediaMetadata",
              m.edited_at as "editedAt", m.deleted_at as "deletedAt",
              m.created_at as "createdAt",
              u.display_name as "senderName", u.avatar_media_id as "senderAvatar",
              -- Reply preview
              rm.plaintext_body as "replyContent", rm.sender_user_id as "replySenderId",
              ru.display_name as "replySenderName",
              -- Reactions count
              (SELECT json_object_agg(emoji, cnt) FROM (
                SELECT emoji, COUNT(*) as cnt FROM message_reactions
                WHERE message_id = m.id GROUP BY emoji
              ) reaction_counts) as reactions
       FROM messages m
       JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = $2 AND cm.state = 'active'
       JOIN users u ON u.id = m.sender_user_id
       LEFT JOIN messages rm ON rm.id = m.reply_to_message_id
       LEFT JOIN users ru ON ru.id = rm.sender_user_id
       WHERE m.chat_id = $1 AND m.deleted_at IS NULL ${cursorClause}
       ORDER BY m.created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    return {
      messages: rows.reverse(), // Return oldest first for display
      hasMore: rows.length === limit,
      cursor: rows.length > 0 ? rows[0].id : null,
    };
  }

  /** Get a single message by ID */
  async getMessageById(messageId: string) {
    const { rows } = await this.pool.query(
      `SELECT m.id, m.chat_id as "chatId", m.sender_user_id as "senderId", m.plaintext_body as "content",
              m.message_type as "msgType", m.reply_to_message_id as "replyToId",
              m.media_url as "mediaUrl", m.media_metadata as "mediaMetadata",
              m.edited_at as "editedAt", m.deleted_at as "deletedAt",
              m.created_at as "createdAt",
              u.display_name as "senderName", u.avatar_media_id as "senderAvatar"
       FROM messages m
       JOIN users u ON u.id = m.sender_user_id
       WHERE m.id = $1`,
      [messageId],
    );
    return rows[0] || null;
  }

  /** Edit a message (only by sender, within time window) */
  async editMessage(messageId: string, userId: string, newContent: string) {
    const { rows } = await this.pool.query(
      `UPDATE messages SET plaintext_body = $3, edited_at = NOW(), state = 'edited'
       WHERE id = $1 AND sender_user_id = $2 AND deleted_at IS NULL
       AND created_at > NOW() - INTERVAL '48 hours'
       RETURNING id`,
      [messageId, userId, newContent],
    );

    if (!rows[0]) {
      throw new Error('Cannot edit: message not found, not your message, or editing window expired (48h)');
    }

    return this.getMessageById(messageId);
  }

  /** Delete a message (soft delete, only by sender or chat admin) */
  async deleteMessage(messageId: string, userId: string, deleteForEveryone: boolean) {
    if (deleteForEveryone) {
      // Check if sender or admin
      const { rows } = await this.pool.query(
        `SELECT m.sender_user_id, cm.role FROM messages m
         JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = $2
         WHERE m.id = $1`,
        [messageId, userId],
      );
      if (!rows[0] || (rows[0].sender_user_id !== userId && !['owner', 'admin'].includes(rows[0].role))) {
        throw new Error('FORBIDDEN: Only sender or admin can delete for everyone');
      }

      await this.pool.query(
        `UPDATE messages SET deleted_at = NOW(), state = 'deleted', plaintext_body = '[Message deleted]' WHERE id = $1`,
        [messageId],
      );
    } else {
      // Delete for self only — soft hide
      await this.pool.query(
        `INSERT INTO message_deletions (id, message_id, user_id, deleted_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (message_id, user_id) DO NOTHING`,
        [uuidv4(), messageId, userId],
      );
    }
  }

  /** Add reaction to a message */
  async addReaction(messageId: string, userId: string, emoji: string) {
    await this.pool.query(
      `INSERT INTO message_reactions (id, message_id, user_id, emoji, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
      [uuidv4(), messageId, userId, emoji],
    );
  }

  /** Remove reaction from a message */
  async removeReaction(messageId: string, userId: string, emoji: string) {
    await this.pool.query(
      `DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
      [messageId, userId, emoji],
    );
  }

  /** Search messages in a chat */
  async searchMessages(chatId: string, userId: string, query: string, limit = 20) {
    const { rows } = await this.pool.query(
      `SELECT m.id, m.plaintext_body as "content", m.sender_user_id as "senderId", m.created_at as "createdAt",
              m.message_type as "msgType", u.display_name as "senderName"
       FROM messages m
       JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = $2 AND cm.state = 'active'
       JOIN users u ON u.id = m.sender_user_id
       WHERE m.chat_id = $1 AND m.deleted_at IS NULL
       AND m.plaintext_body ILIKE '%' || $3 || '%'
       ORDER BY m.created_at DESC
       LIMIT $4`,
      [chatId, userId, query, limit],
    );
    return rows;
  }

  /** Forward a message to another chat */
  async forwardMessage(messageId: string, toChatId: string, userId: string) {
    const original = await this.getMessageById(messageId);
    if (!original) throw new Error('Message not found');

    return this.createMessage({
      chatId: toChatId,
      senderId: userId,
      content: original.content,
      msgType: original.msgType,
      forwardFromId: messageId,
      mediaUrl: original.mediaUrl,
      mediaMetadata: original.mediaMetadata,
    });
  }
}

// --- STORY/STATUS REPOSITORY (Instagram/Snapchat-like) ---

export class PostgresStoryRepository {
  constructor(private readonly pool: Pool) {}

  /** Create a story (expires in 24h like WhatsApp/Instagram) */
  async createStory(data: {
    userId: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    caption?: string;
    backgroundColor?: string;
    duration?: number; // seconds for video
  }) {
    const storyId = uuidv4();
    await this.pool.query(
      `INSERT INTO stories (id, user_id, media_url, media_type, caption, background_color,
                           duration_seconds, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '24 hours', NOW())`,
      [storyId, data.userId, data.mediaUrl, data.mediaType, data.caption || null,
       data.backgroundColor || null, data.duration || null],
    );
    return { id: storyId };
  }

  /** Get stories from users I follow / my contacts (last 24h) */
  async getStoryFeed(userId: string) {
    const { rows } = await this.pool.query(
      `SELECT s.id, s.user_id as "userId", s.media_url as "mediaUrl",
              s.media_type as "mediaType", s.caption, s.background_color as "backgroundColor",
              s.duration_seconds as "duration", s.created_at as "createdAt",
              s.expires_at as "expiresAt",
              u.display_name as "userName", u.avatar_media_id as "userAvatar",
              -- Has the current user seen this story?
              EXISTS(SELECT 1 FROM story_views sv WHERE sv.story_id = s.id AND sv.viewer_id = $1) as "viewed",
              -- View count (only for own stories)
              CASE WHEN s.user_id = $1 THEN
                (SELECT COUNT(*) FROM story_views WHERE story_id = s.id)::int
              END as "viewCount"
       FROM stories s
       JOIN users u ON u.id = s.user_id
       WHERE s.expires_at > NOW()
       AND (s.user_id = $1 OR s.user_id IN (
         SELECT cm.user_id FROM chat_members cm
         JOIN chat_members my ON my.chat_id = cm.chat_id AND my.user_id = $1
         WHERE cm.user_id != $1 AND cm.state = 'active'
       ))
       ORDER BY s.user_id = $1 DESC, s.created_at DESC`,
      [userId],
    );

    // Group by user
    const grouped = new Map<string, { user: Record<string, unknown>; stories: Record<string, unknown>[] }>();
    for (const row of rows) {
      if (!grouped.has(row.userId)) {
        grouped.set(row.userId, {
          user: { id: row.userId, name: row.userName, avatar: row.userAvatar },
          stories: [],
        });
      }
      grouped.get(row.userId)!.stories.push(row);
    }
    return Array.from(grouped.values());
  }

  /** View a story (mark as seen) */
  async viewStory(storyId: string, viewerId: string) {
    await this.pool.query(
      `INSERT INTO story_views (id, story_id, viewer_id, viewed_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (story_id, viewer_id) DO NOTHING`,
      [uuidv4(), storyId, viewerId],
    );
  }

  /** Delete a story (own only) */
  async deleteStory(storyId: string, userId: string) {
    await this.pool.query(
      `DELETE FROM stories WHERE id = $1 AND user_id = $2`,
      [storyId, userId],
    );
  }

  /** React to a story */
  async reactToStory(storyId: string, userId: string, emoji: string) {
    await this.pool.query(
      `INSERT INTO story_reactions (id, story_id, user_id, emoji, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (story_id, user_id) DO UPDATE SET emoji = $4`,
      [uuidv4(), storyId, userId, emoji],
    );
  }
}
