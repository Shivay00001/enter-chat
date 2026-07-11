import type { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../shared/logger.js';

const walletLogger = logger.child({ component: 'wallet-repo' });

/**
 * PostgreSQL Wallet Repository — atomic balance operations with row-level locking.
 * All monetary operations use transactions + SELECT FOR UPDATE to prevent double-spend.
 */
export class PostgresWalletRepository {
  constructor(private readonly pool: Pool) {}

  /** Get or create wallet for a user */
  async getOrCreateWallet(userId: string, currency = 'INR') {
    // Try to get existing
    const { rows } = await this.pool.query(
      `SELECT id, user_id as "userId", balance, currency, is_frozen as "isFrozen",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM wallets WHERE user_id = $1`,
      [userId],
    );

    if (rows[0]) return rows[0];

    // Create new wallet
    const walletId = uuidv4();
    const { rows: created } = await this.pool.query(
      `INSERT INTO wallets (id, user_id, balance, currency)
       VALUES ($1, $2, 0, $3)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
       RETURNING id, user_id as "userId", balance, currency, is_frozen as "isFrozen",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [walletId, userId, currency],
    );

    walletLogger.info({ userId, walletId }, 'Wallet created');
    return created[0];
  }

  /** Get wallet balance */
  async getBalance(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);
    return { balance: parseInt(wallet.balance, 10), currency: wallet.currency, isFrozen: wallet.isFrozen };
  }

  /** Credit (add money) to wallet — ATOMIC with row lock */
  async credit(params: {
    userId: string;
    amount: number;
    source: string;
    referenceId?: string;
    description?: string;
    metadata?: Record<string, unknown>;
    client?: PoolClient; // Allow passing external client for P2P transactions
  }): Promise<{ newBalance: number; transactionId: string }> {
    const client = params.client || await this.pool.connect();
    const isExternal = !!params.client;

    try {
      if (!isExternal) await client.query('BEGIN');

      await this.getOrCreateWallet(params.userId);

      // Lock wallet row for update
      const { rows: locked } = await client.query(
        `SELECT id, balance, is_frozen FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [params.userId],
      );

      if (!locked[0]) throw new Error('Wallet not found');
      if (locked[0].is_frozen) throw new Error('WALLET_FROZEN');

      const currentBalance = parseInt(locked[0].balance, 10);
      const newBalance = currentBalance + params.amount;

      // Update balance
      await client.query(
        `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2`,
        [newBalance, locked[0].id],
      );

      // Record transaction
      const txId = uuidv4();
      await client.query(
        `INSERT INTO wallet_transactions (id, wallet_id, user_id, tx_type, source, amount, balance_after, reference_id, description, metadata)
         VALUES ($1, $2, $3, 'credit', $4, $5, $6, $7, $8, $9)`,
        [txId, locked[0].id, params.userId, params.source, params.amount, newBalance,
         params.referenceId || null, params.description || null,
         params.metadata ? JSON.stringify(params.metadata) : null],
      );

      if (!isExternal) await client.query('COMMIT');

      walletLogger.info({ userId: params.userId, amount: params.amount, newBalance, source: params.source }, 'Wallet credited');
      return { newBalance, transactionId: txId };
    } catch (err) {
      if (!isExternal) await client.query('ROLLBACK');
      throw err;
    } finally {
      if (!isExternal) client.release();
    }
  }

  /** Debit (withdraw/spend) from wallet — ATOMIC with row lock + balance check */
  async debit(params: {
    userId: string;
    amount: number;
    source: string;
    referenceId?: string;
    description?: string;
    metadata?: Record<string, unknown>;
    client?: PoolClient;
  }): Promise<{ newBalance: number; transactionId: string }> {
    const client = params.client || await this.pool.connect();
    const isExternal = !!params.client;

    try {
      if (!isExternal) await client.query('BEGIN');

      await this.getOrCreateWallet(params.userId);

      // Lock wallet row
      const { rows: locked } = await client.query(
        `SELECT id, balance, is_frozen FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [params.userId],
      );

      if (!locked[0]) throw new Error('Wallet not found');
      if (locked[0].is_frozen) throw new Error('WALLET_FROZEN');

      const currentBalance = parseInt(locked[0].balance, 10);
      if (currentBalance < params.amount) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      const newBalance = currentBalance - params.amount;

      // Update balance
      await client.query(
        `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2`,
        [newBalance, locked[0].id],
      );

      // Record transaction
      const txId = uuidv4();
      await client.query(
        `INSERT INTO wallet_transactions (id, wallet_id, user_id, tx_type, source, amount, balance_after, reference_id, description, metadata)
         VALUES ($1, $2, $3, 'debit', $4, $5, $6, $7, $8, $9)`,
        [txId, locked[0].id, params.userId, params.source, params.amount, newBalance,
         params.referenceId || null, params.description || null,
         params.metadata ? JSON.stringify(params.metadata) : null],
      );

      if (!isExternal) await client.query('COMMIT');

      walletLogger.info({ userId: params.userId, amount: params.amount, newBalance, source: params.source }, 'Wallet debited');
      return { newBalance, transactionId: txId };
    } catch (err) {
      if (!isExternal) await client.query('ROLLBACK');
      throw err;
    } finally {
      if (!isExternal) client.release();
    }
  }

  /** P2P atomic transfer — debit sender + credit receiver in single transaction */
  async atomicTransfer(senderId: string, receiverId: string, amount: number, note?: string, chatId?: string): Promise<{
    transferId: string;
    senderBalance: number;
    receiverBalance: number;
  }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const transferId = uuidv4();

      // Debit sender
      const senderResult = await this.debit({
        userId: senderId,
        amount,
        source: 'p2p_send',
        referenceId: transferId,
        description: note || 'Sent money',
        client,
      });

      // Credit receiver
      const receiverResult = await this.credit({
        userId: receiverId,
        amount,
        source: 'p2p_receive',
        referenceId: transferId,
        description: note || 'Received money',
        client,
      });

      // Record P2P transfer
      await client.query(
        `INSERT INTO p2p_transfers (id, sender_id, receiver_id, amount, status, transfer_type, note, chat_id, completed_at)
         VALUES ($1, $2, $3, $4, 'completed', 'send', $5, $6, NOW())`,
        [transferId, senderId, receiverId, amount, note || null, chatId || null],
      );

      await client.query('COMMIT');

      walletLogger.info({ senderId, receiverId, amount, transferId }, 'P2P transfer completed');

      return {
        transferId,
        senderBalance: senderResult.newBalance,
        receiverBalance: receiverResult.newBalance,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Get transaction history */
  async getTransactions(userId: string, limit = 50, offset = 0) {
    const { rows } = await this.pool.query(
      `SELECT id, tx_type as "txType", source, amount, balance_after as "balanceAfter",
              currency, reference_id as "referenceId", description, metadata,
              created_at as "createdAt"
       FROM wallet_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    return rows;
  }

  /** Get UPI linked accounts */
  async getUpiAccounts(userId: string) {
    const { rows } = await this.pool.query(
      `SELECT id, upi_id as "upiId", provider, is_primary as "isPrimary",
              is_verified as "isVerified", display_name as "displayName"
       FROM upi_linked_accounts WHERE user_id = $1 ORDER BY is_primary DESC`,
      [userId],
    );
    return rows;
  }

  /** Link a UPI account */
  async linkUpiAccount(userId: string, upiId: string, provider?: string) {
    const { rows } = await this.pool.query(
      `INSERT INTO upi_linked_accounts (user_id, upi_id, provider, is_primary)
       VALUES ($1, $2, $3, (SELECT COUNT(*) = 0 FROM upi_linked_accounts WHERE user_id = $1))
       ON CONFLICT (user_id, upi_id) DO UPDATE SET provider = COALESCE($3, upi_linked_accounts.provider)
       RETURNING id, upi_id as "upiId", provider, is_primary as "isPrimary"`,
      [userId, upiId, provider || null],
    );
    return rows[0];
  }

  /** Unlink a UPI account */
  async unlinkUpiAccount(userId: string, accountId: string) {
    await this.pool.query(
      `DELETE FROM upi_linked_accounts WHERE id = $1 AND user_id = $2`,
      [accountId, userId],
    );
  }
}
