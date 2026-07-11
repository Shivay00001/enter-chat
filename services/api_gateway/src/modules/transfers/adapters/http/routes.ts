import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../../../../middleware/auth.js';
import { getDbPool } from '../../../../shared/db.js';
import { logger } from '../../../../shared/logger.js';
import { PostgresWalletRepository } from '../../../wallet/adapters/postgres.js';

const transferLogger = logger.child({ component: 'transfers' });
const transfersRouter = Router();

// --- POST /v1/transfers/send ---
// Send money to another user (wallet-to-wallet).
const sendSchema = z.object({
  receiverId: z.string().uuid(),
  amount: z.number().int().min(100).max(10000000), // Min ₹1, max ₹1L
  note: z.string().max(200).optional(),
  chatId: z.string().uuid().optional(), // If sent from within a chat
});

transfersRouter.post('/send', authMiddleware, async (req, res, next) => {
  try {
    const senderId = req.userId!;
    const body = sendSchema.parse(req.body);

    if (senderId === body.receiverId) {
      res.status(400).json({ error: { code: 'SELF_TRANSFER', message: 'Cannot send money to yourself' } });
      return;
    }

    const pool = getDbPool();
    const walletRepo = new PostgresWalletRepository(pool);

    // Verify receiver exists
    const { rows: receiver } = await pool.query(
      `SELECT id, display_name FROM users WHERE id = $1`,
      [body.receiverId],
    );
    if (!receiver[0]) {
      res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'Recipient not found' } });
      return;
    }

    // Atomic transfer
    const result = await walletRepo.atomicTransfer(
      senderId, body.receiverId, body.amount, body.note, body.chatId,
    );

    // If within a chat, create a system message
    let messageId: string | undefined;
    if (body.chatId) {
      const msgId = uuidv4();
      await pool.query(
        `INSERT INTO messages (id, chat_id, sender_id, content, msg_type, media_metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'text', $5, NOW(), NOW())`,
        [msgId, body.chatId, senderId,
         `💸 Sent ${formatCurrency(body.amount, 'INR')}${body.note ? ` — "${body.note}"` : ''}`,
         JSON.stringify({ type: 'payment', transferId: result.transferId, amount: body.amount })],
      );
      messageId = msgId;
    }

    // Supabase Postgres CDC automatically broadcasts the transfer status.

    transferLogger.info({ senderId, receiverId: body.receiverId, amount: body.amount }, 'P2P transfer completed');

    res.json({
      transferId: result.transferId,
      status: 'completed',
      amount: body.amount,
      amountFormatted: formatCurrency(body.amount, 'INR'),
      senderNewBalance: result.senderBalance,
      receiverName: receiver[0].display_name,
      messageId,
    });
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      res.status(400).json({ error: { code: 'INSUFFICIENT_BALANCE', message: 'Not enough balance to send' } });
      return;
    }
    if (err.message === 'WALLET_FROZEN') {
      res.status(403).json({ error: { code: 'WALLET_FROZEN', message: 'Your wallet is frozen' } });
      return;
    }
    next(err);
  }
});

// --- POST /v1/transfers/request ---
// Request money from another user.
const requestSchema = z.object({
  fromUserId: z.string().uuid(),
  amount: z.number().int().min(100).max(10000000),
  note: z.string().max(200).optional(),
  chatId: z.string().uuid().optional(),
});

transfersRouter.post('/request', authMiddleware, async (req, res, next) => {
  try {
    const requesterId = req.userId!;
    const body = requestSchema.parse(req.body);
    const pool = getDbPool();

    const transferId = uuidv4();
    await pool.query(
      `INSERT INTO p2p_transfers (id, sender_id, receiver_id, amount, status, transfer_type, note, chat_id)
       VALUES ($1, $2, $3, $4, 'pending', 'request', $5, $6)`,
      [transferId, body.fromUserId, requesterId, body.amount, body.note || null, body.chatId || null],
    );

    // Supabase Postgres CDC automatically broadcasts the pending request.

    // If within a chat, send system message
    if (body.chatId) {
      await pool.query(
        `INSERT INTO messages (id, chat_id, sender_id, content, msg_type, media_metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'text', $5, NOW(), NOW())`,
        [uuidv4(), body.chatId, requesterId,
         `🔔 Requested ${formatCurrency(body.amount, 'INR')}${body.note ? ` — "${body.note}"` : ''}`,
         JSON.stringify({ type: 'payment_request', transferId, amount: body.amount })],
      );
    }

    res.json({ transferId, status: 'pending', amount: body.amount });
  } catch (err) {
    next(err);
  }
});

// --- GET /v1/transfers/:id ---
// Get transfer details.
transfersRouter.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const transferId = req.params['id']!;
    const pool = getDbPool();

    const { rows } = await pool.query(
      `SELECT t.id, t.sender_id as "senderId", t.receiver_id as "receiverId",
              t.amount, t.currency, t.status, t.transfer_type as "transferType",
              t.note, t.chat_id as "chatId", t.completed_at as "completedAt",
              t.created_at as "createdAt",
              su.display_name as "senderName", ru.display_name as "receiverName"
       FROM p2p_transfers t
       JOIN users su ON su.id = t.sender_id
       JOIN users ru ON ru.id = t.receiver_id
       WHERE t.id = $1 AND (t.sender_id = $2 OR t.receiver_id = $2)`,
      [transferId, userId],
    );

    if (!rows[0]) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transfer not found' } });
      return;
    }

    res.json({ transfer: { ...rows[0], amount: parseInt(rows[0].amount, 10) } });
  } catch (err) {
    next(err);
  }
});

// --- POST /v1/transfers/:id/accept ---
// Accept a money request (pay the requested amount).
transfersRouter.post('/:id/accept', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const transferId = req.params['id']!;
    const pool = getDbPool();

    // Get the pending request
    const { rows } = await pool.query(
      `SELECT id, sender_id, receiver_id, amount, status
       FROM p2p_transfers WHERE id = $1 AND sender_id = $2 AND status = 'pending'`,
      [transferId, userId],
    );

    if (!rows[0]) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pending request not found' } });
      return;
    }

    const transfer = rows[0];
    const walletRepo = new PostgresWalletRepository(pool);

    // Execute transfer
    const result = await walletRepo.atomicTransfer(
      transfer.sender_id, transfer.receiver_id, parseInt(transfer.amount, 10),
    );

    // Update transfer status
    await pool.query(
      `UPDATE p2p_transfers SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [transferId],
    );

    // Supabase Postgres CDC automatically broadcasts the accepted transfer.

    res.json({ status: 'completed', transferId, senderNewBalance: result.senderBalance });
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      res.status(400).json({ error: { code: 'INSUFFICIENT_BALANCE', message: 'Not enough balance' } });
      return;
    }
    next(err);
  }
});

// --- POST /v1/transfers/:id/decline ---
// Decline a money request.
transfersRouter.post('/:id/decline', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const transferId = req.params['id']!;
    const pool = getDbPool();

    const { rows } = await pool.query(
      `UPDATE p2p_transfers SET status = 'declined'
       WHERE id = $1 AND sender_id = $2 AND status = 'pending'
       RETURNING receiver_id`,
      [transferId, userId],
    );

    if (!rows[0]) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pending request not found' } });
      return;
    }

    // Supabase Postgres CDC automatically broadcasts the declined transfer.

    res.json({ status: 'declined', transferId });
  } catch (err) {
    next(err);
  }
});

function formatCurrency(amountPaisa: number, currency: string): string {
  const major = amountPaisa / 100;
  switch (currency) {
    case 'INR': return `₹${major.toFixed(2)}`;
    case 'USD': return `$${major.toFixed(2)}`;
    default: return `${major.toFixed(2)} ${currency}`;
  }
}

export { transfersRouter };
