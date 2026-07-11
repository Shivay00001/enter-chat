import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../../../middleware/auth.js';
import { getDbPool } from '../../../../shared/db.js';
import { logger } from '../../../../shared/logger.js';
import { PostgresWalletRepository } from '../postgres.js';
import { getPaymentGateway, getGatewayForCurrency } from '../../../../services/payment-gateway.js';
import { v4 as uuidv4 } from 'uuid';

const walletLogger = logger.child({ component: 'wallet-routes' });
const walletRouter = Router();

// --- GET /v1/wallet ---
// Get wallet balance, info, and linked UPI accounts.
walletRouter.get('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const pool = getDbPool();
    const repo = new PostgresWalletRepository(pool);

    const wallet = await repo.getOrCreateWallet(userId);
    const upiAccounts = await repo.getUpiAccounts(userId);

    res.json({
      wallet: {
        id: wallet.id,
        balance: parseInt(wallet.balance, 10),
        balanceFormatted: formatCurrency(parseInt(wallet.balance, 10), wallet.currency),
        currency: wallet.currency,
        isFrozen: wallet.isFrozen,
      },
      upiAccounts,
    });
  } catch (err) {
    next(err);
  }
});

// --- GET /v1/wallet/transactions ---
// Paginated transaction history.
walletRouter.get('/transactions', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const limit = Math.min(parseInt(req.query['limit'] as string) || 50, 100);
    const offset = parseInt(req.query['offset'] as string) || 0;

    const pool = getDbPool();
    const repo = new PostgresWalletRepository(pool);
    const transactions = await repo.getTransactions(userId, limit, offset);

    res.json({
      transactions: transactions.map(tx => ({
        ...tx,
        amount: parseInt(tx.amount, 10),
        balanceAfter: parseInt(tx.balanceAfter, 10),
        amountFormatted: formatCurrency(parseInt(tx.amount, 10), tx.currency),
      })),
      pagination: { limit, offset, hasMore: transactions.length === limit },
    });
  } catch (err) {
    next(err);
  }
});

// --- POST /v1/wallet/add-money ---
// Create a payment order to add money to wallet.
const addMoneySchema = z.object({
  amount: z.number().int().min(100).max(10000000), // Min ₹1 (100 paisa), max ₹1,00,000
  currency: z.string().length(3).default('INR'),
  paymentMethod: z.enum(['upi', 'card', 'netbanking', 'wallet', 'paypal']).optional(),
  upiId: z.string().max(100).optional(),
});

walletRouter.post('/add-money', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = addMoneySchema.parse(req.body);

    const pool = getDbPool();
    const repo = new PostgresWalletRepository(pool);

    // Ensure wallet exists
    await repo.getOrCreateWallet(userId, body.currency);

    // Get appropriate gateway
    const gateway = getGatewayForCurrency(body.currency);

    // Create payment order
    const order = await gateway.createOrder({
      amount: body.amount,
      currency: body.currency,
      purpose: 'add_money',
      userId,
      paymentMethod: body.paymentMethod,
      upiId: body.upiId,
    });

    // Persist order in DB
    const orderId = uuidv4();
    await pool.query(
      `INSERT INTO payment_orders (id, user_id, amount, currency, provider, provider_order_id, status, purpose, payment_method, upi_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'created', 'add_money', $7, $8, $9)`,
      [orderId, userId, body.amount, body.currency, gateway.provider, order.providerOrderId,
       body.paymentMethod || null, body.upiId || null, order.expiresAt],
    );

    walletLogger.info({ userId, amount: body.amount, orderId }, 'Add money order created');

    res.json({
      orderId,
      providerOrderId: order.providerOrderId,
      amount: body.amount,
      amountFormatted: formatCurrency(body.amount, body.currency),
      checkoutUrl: order.checkoutUrl,
      upiDeepLink: order.upiDeepLink,
      expiresAt: order.expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

// --- POST /v1/wallet/add-money/callback ---
// Payment gateway webhook / client verification callback.
const callbackSchema = z.object({
  orderId: z.string().uuid(),
  providerPaymentId: z.string().min(1),
  providerSignature: z.string().optional(),
});

walletRouter.post('/add-money/callback', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = callbackSchema.parse(req.body);
    const pool = getDbPool();

    // Get the order
    const { rows: orders } = await pool.query(
      `SELECT id, amount, currency, provider, provider_order_id, status
       FROM payment_orders WHERE id = $1 AND user_id = $2`,
      [body.orderId, userId],
    );

    if (!orders[0]) {
      res.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: 'Payment order not found' } });
      return;
    }

    const order = orders[0];
    if (order.status !== 'created' && order.status !== 'pending') {
      res.status(400).json({ error: { code: 'ORDER_ALREADY_PROCESSED', message: `Order is already ${order.status}` } });
      return;
    }

    // Verify with gateway
    const gateway = getPaymentGateway(order.provider);
    const verification = await gateway.verifyPayment({
      providerOrderId: order.provider_order_id,
      providerPaymentId: body.providerPaymentId,
      providerSignature: body.providerSignature,
    });

    if (verification.verified && verification.status === 'captured') {
      // Update order status
      await pool.query(
        `UPDATE payment_orders SET status = 'captured', provider_payment_id = $1, payment_method = $2, updated_at = NOW()
         WHERE id = $3`,
        [body.providerPaymentId, verification.method, body.orderId],
      );

      // Credit wallet
      const repo = new PostgresWalletRepository(pool);
      const result = await repo.credit({
        userId,
        amount: parseInt(order.amount, 10),
        source: 'add_money',
        referenceId: body.orderId,
        description: `Added ${formatCurrency(parseInt(order.amount, 10), order.currency)} via ${verification.method || 'payment'}`,
      });

      walletLogger.info({ userId, amount: order.amount, orderId: body.orderId }, 'Add money completed');

      res.json({
        status: 'success',
        newBalance: result.newBalance,
        newBalanceFormatted: formatCurrency(result.newBalance, order.currency),
        transactionId: result.transactionId,
      });
    } else {
      // Payment failed
      await pool.query(
        `UPDATE payment_orders SET status = 'failed', failure_reason = $1, updated_at = NOW()
         WHERE id = $2`,
        [verification.failureReason || 'Payment verification failed', body.orderId],
      );

      res.status(402).json({ error: { code: 'PAYMENT_FAILED', message: verification.failureReason || 'Payment verification failed' } });
    }
  } catch (err) {
    next(err);
  }
});

// --- POST /v1/wallet/withdraw ---
// Withdraw to UPI/bank account.
const withdrawSchema = z.object({
  amount: z.number().int().min(100),
  upiAccountId: z.string().uuid().optional(),
  upiId: z.string().max(100).optional(),
});

walletRouter.post('/withdraw', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = withdrawSchema.parse(req.body);

    if (!body.upiAccountId && !body.upiId) {
      res.status(400).json({ error: { code: 'UPI_REQUIRED', message: 'Provide upiAccountId or upiId for withdrawal' } });
      return;
    }

    const pool = getDbPool();
    const repo = new PostgresWalletRepository(pool);

    // Debit wallet
    const result = await repo.debit({
      userId,
      amount: body.amount,
      source: 'withdraw',
      description: `Withdrawn to UPI: ${body.upiId || body.upiAccountId}`,
    });

    walletLogger.info({ userId, amount: body.amount }, 'Withdrawal initiated');

    res.json({
      status: 'processing',
      newBalance: result.newBalance,
      newBalanceFormatted: formatCurrency(result.newBalance, 'INR'),
      transactionId: result.transactionId,
      estimatedArrival: '1-3 business days',
    });
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      res.status(400).json({ error: { code: 'INSUFFICIENT_BALANCE', message: 'Not enough balance for withdrawal' } });
      return;
    }
    next(err);
  }
});

// --- POST /v1/wallet/upi/link ---
// Link a UPI account.
const linkUpiSchema = z.object({
  upiId: z.string().min(3).max(100).regex(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/, 'Invalid UPI ID format'),
  provider: z.enum(['bhim', 'gpay', 'phonepe', 'paytm', 'mobikwik', 'other']).optional(),
});

walletRouter.post('/upi/link', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = linkUpiSchema.parse(req.body);

    const pool = getDbPool();
    const repo = new PostgresWalletRepository(pool);
    const account = await repo.linkUpiAccount(userId, body.upiId, body.provider);

    res.json({ upiAccount: account });
  } catch (err) {
    next(err);
  }
});

// --- DELETE /v1/wallet/upi/:accountId ---
// Unlink a UPI account.
walletRouter.delete('/upi/:accountId', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const accountId = req.params['accountId'] as string;

    const pool = getDbPool();
    const repo = new PostgresWalletRepository(pool);
    await repo.unlinkUpiAccount(userId, accountId);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Utility ---
function formatCurrency(amountInSmallestUnit: number, currency: string): string {
  const major = amountInSmallestUnit / 100;
  switch (currency) {
    case 'INR': return `₹${major.toFixed(2)}`;
    case 'USD': return `$${major.toFixed(2)}`;
    case 'EUR': return `€${major.toFixed(2)}`;
    default: return `${major.toFixed(2)} ${currency}`;
  }
}

export { walletRouter };
