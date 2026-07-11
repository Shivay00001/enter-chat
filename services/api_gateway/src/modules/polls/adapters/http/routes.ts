import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../../../middleware/auth.js';
import { getDbPool } from '../../../../shared/db.js';

const pollsRouter = Router();

const createPollSchema = z.object({
  chatId: z.string().uuid(),
  question: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).min(2).max(12),
  pollType: z.enum(['single', 'multiple']).default('single'),
  isAnonymous: z.boolean().default(false),
  closesAt: z.string().datetime().optional(),
});

const voteSchema = z.object({
  optionIds: z.array(z.string().uuid()).min(1),
});

/**
 * POST /v1/polls
 * Create a poll in a chat. Creates both the poll record and a system message.
 */
pollsRouter.post('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = createPollSchema.parse(req.body);
    const pool = getDbPool();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create a message for the poll
      const { rows: [msg] } = await client.query(
        `INSERT INTO messages (chat_id, sender_user_id, message_type, plaintext_body, idempotency_key, created_at)
         VALUES ($1, $2, 'poll', $3, $4, NOW())
         RETURNING id, created_at`,
        [body.chatId, userId, body.question, `poll_${Date.now()}_${userId}`],
      );

      // Create poll
      const { rows: [poll] } = await client.query(
        `INSERT INTO polls (chat_id, message_id, creator_id, question, poll_type, is_anonymous, closes_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [body.chatId, msg.id, userId, body.question, body.pollType, body.isAnonymous, body.closesAt || null],
      );

      // Create options
      const options = [];
      for (let i = 0; i < body.options.length; i++) {
        const { rows: [opt] } = await client.query(
          `INSERT INTO poll_options (poll_id, option_text, sort_order)
           VALUES ($1, $2, $3)
           RETURNING id, option_text as "optionText", sort_order as "sortOrder"`,
          [poll.id, body.options[i], i],
        );
        options.push({ ...opt, voteCount: 0 });
      }

      await client.query('COMMIT');

      res.status(201).json({
        id: poll.id,
        chatId: body.chatId,
        messageId: msg.id,
        question: body.question,
        pollType: body.pollType,
        isAnonymous: body.isAnonymous,
        options,
        totalVotes: 0,
        createdAt: msg.created_at,
      });
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
 * POST /v1/polls/:pollId/vote
 * Vote on a poll.
 */
pollsRouter.post('/:pollId/vote', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const pollId = req.params['pollId'] as string;
    const body = voteSchema.parse(req.body);
    const pool = getDbPool();

    // Check poll exists and is open
    const { rows: [poll] } = await pool.query(
      `SELECT poll_type as "pollType", is_closed as "isClosed", closes_at as "closesAt"
       FROM polls WHERE id = $1`,
      [pollId],
    );

    if (!poll) {
      res.status(404).json({ error: { code: 'POLL_NOT_FOUND', message: 'Poll not found' } });
      return;
    }

    if (poll.isClosed || (poll.closesAt && new Date(poll.closesAt) < new Date())) {
      res.status(400).json({ error: { code: 'POLL_CLOSED', message: 'This poll is closed' } });
      return;
    }

    if (poll.pollType === 'single' && body.optionIds.length > 1) {
      res.status(400).json({ error: { code: 'SINGLE_CHOICE', message: 'This poll allows only one choice' } });
      return;
    }

    // Remove previous votes and add new ones
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM poll_votes WHERE poll_id = $1 AND user_id = $2`, [pollId, userId]);

      for (const optionId of body.optionIds) {
        await client.query(
          `INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES ($1, $2, $3)`,
          [pollId, optionId, userId],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/polls/:pollId
 * Get poll with results.
 */
pollsRouter.get('/:pollId', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const pollId = req.params['pollId'] as string;
    const pool = getDbPool();

    const { rows: [poll] } = await pool.query(
      `SELECT p.id, p.chat_id as "chatId", p.message_id as "messageId", p.question,
              p.poll_type as "pollType", p.is_anonymous as "isAnonymous",
              p.is_closed as "isClosed", p.closes_at as "closesAt", p.created_at as "createdAt"
       FROM polls p WHERE p.id = $1`,
      [pollId],
    );

    if (!poll) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Poll not found' } });
      return;
    }

    // Get options with vote counts
    const { rows: options } = await pool.query(
      `SELECT po.id, po.option_text as "optionText", po.sort_order as "sortOrder",
              COUNT(pv.user_id)::int as "voteCount",
              BOOL_OR(pv.user_id = $2) as "myVote"
       FROM poll_options po
       LEFT JOIN poll_votes pv ON pv.option_id = po.id
       WHERE po.poll_id = $1
       GROUP BY po.id, po.option_text, po.sort_order
       ORDER BY po.sort_order`,
      [pollId, userId],
    );

    const totalVotes = options.reduce((sum: number, o: any) => sum + o.voteCount, 0);

    res.json({ ...poll, options, totalVotes });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/polls/:pollId/close
 * Close a poll (creator only).
 */
pollsRouter.post('/:pollId/close', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const pollId = req.params['pollId'] as string;
    const pool = getDbPool();

    const { rowCount } = await pool.query(
      `UPDATE polls SET is_closed = TRUE WHERE id = $1 AND creator_id = $2`,
      [pollId, userId],
    );

    if (rowCount === 0) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only poll creator can close it' } });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export { pollsRouter };
