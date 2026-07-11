import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../../../../middleware/auth.js';
import { getDbPool } from '../../../../shared/db.js';
import { logger } from '../../../../shared/logger.js';
import { PostgresWalletRepository } from '../../../wallet/adapters/postgres.js';

const subLogger = logger.child({ component: 'subscriptions' });
const subscriptionsRouter = Router();

// --- GET /v1/subscriptions/plans ---
// List all available subscription plans.
subscriptionsRouter.get('/plans', async (_req, res, next) => {
  try {
    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT id, tier, name, description, price_inr as "priceInr", price_usd as "priceUsd",
              features, max_devices as "maxDevices"
       FROM subscription_plans WHERE is_active = true ORDER BY price_inr ASC`,
    );

    res.json({
      plans: rows.map(p => ({
        ...p,
        priceInr: parseInt(p.priceInr, 10),
        priceUsd: parseInt(p.priceUsd, 10),
        priceInrFormatted: `₹${(parseInt(p.priceInr, 10) / 100).toFixed(0)}/mo`,
        priceUsdFormatted: `$${(parseInt(p.priceUsd, 10) / 100).toFixed(2)}/mo`,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// --- GET /v1/subscriptions/current ---
// Get the user's current subscription.
subscriptionsRouter.get('/current', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const pool = getDbPool();

    const { rows } = await pool.query(
      `SELECT s.id, s.tier, s.status, s.current_period_start as "periodStart",
              s.current_period_end as "periodEnd", s.cancelled_at as "cancelledAt",
              sp.name as "planName", sp.features, sp.max_devices as "maxDevices",
              sp.price_inr as "priceInr", sp.price_usd as "priceUsd"
       FROM subscriptions s
       JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE s.user_id = $1 AND s.status = 'active'
       ORDER BY s.created_at DESC LIMIT 1`,
      [userId],
    );

    if (!rows[0]) {
      // No active subscription — return free tier
      const { rows: freePlan } = await pool.query(
        `SELECT id, tier, name, features, max_devices as "maxDevices"
         FROM subscription_plans WHERE tier = 'free'`,
      );
      res.json({
        subscription: {
          tier: 'free',
          status: 'active',
          planName: 'Free',
          features: freePlan[0]?.features || [],
          maxDevices: 1,
          isFreeTier: true,
        },
      });
      return;
    }

    res.json({
      subscription: {
        ...rows[0],
        priceInr: parseInt(rows[0].priceInr, 10),
        priceUsd: parseInt(rows[0].priceUsd, 10),
        isFreeTier: rows[0].tier === 'free',
      },
    });
  } catch (err) {
    next(err);
  }
});

// --- POST /v1/subscriptions/subscribe ---
// Subscribe to a plan (pay from wallet or create gateway order).
const subscribeSchema = z.object({
  planId: z.string().uuid(),
  paymentSource: z.enum(['wallet', 'gateway']).default('wallet'),
  currency: z.string().length(3).default('INR'),
});

subscriptionsRouter.post('/subscribe', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = subscribeSchema.parse(req.body);
    const pool = getDbPool();

    // Get the plan
    const { rows: plans } = await pool.query(
      `SELECT id, tier, name, price_inr, price_usd FROM subscription_plans WHERE id = $1 AND is_active = true`,
      [body.planId],
    );
    if (!plans[0]) {
      res.status(404).json({ error: { code: 'PLAN_NOT_FOUND', message: 'Subscription plan not found' } });
      return;
    }

    const plan = plans[0];
    const price = body.currency === 'INR' ? parseInt(plan.price_inr, 10) : parseInt(plan.price_usd, 10);

    // Check if user already has an active subscription
    const { rows: existing } = await pool.query(
      `SELECT id, tier FROM subscriptions WHERE user_id = $1 AND status = 'active'`,
      [userId],
    );
    if (existing[0] && existing[0].tier === plan.tier) {
      res.status(400).json({ error: { code: 'ALREADY_SUBSCRIBED', message: 'You are already on this plan' } });
      return;
    }

    if (body.paymentSource === 'wallet' && price > 0) {
      // Pay from wallet
      const walletRepo = new PostgresWalletRepository(pool);
      try {
        await walletRepo.debit({
          userId,
          amount: price,
          source: 'subscription',
          description: `${plan.name} subscription`,
        });
      } catch (err: any) {
        if (err.message === 'INSUFFICIENT_BALANCE') {
          res.status(400).json({ error: { code: 'INSUFFICIENT_BALANCE', message: 'Not enough wallet balance. Add money first.' } });
          return;
        }
        throw err;
      }
    }

    // Cancel existing active subscription
    if (existing[0]) {
      await pool.query(
        `UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [existing[0].id],
      );
    }

    // Create new subscription
    const subId = uuidv4();
    await pool.query(
      `INSERT INTO subscriptions (id, user_id, plan_id, tier, status, current_period_start, current_period_end)
       VALUES ($1, $2, $3, $4, 'active', NOW(), NOW() + INTERVAL '30 days')`,
      [subId, userId, body.planId, plan.tier],
    );

    subLogger.info({ userId, tier: plan.tier, planId: body.planId }, 'Subscription created');

    res.json({
      subscriptionId: subId,
      tier: plan.tier,
      planName: plan.name,
      status: 'active',
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// --- POST /v1/subscriptions/cancel ---
// Cancel current subscription.
subscriptionsRouter.post('/cancel', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const pool = getDbPool();

    const { rows } = await pool.query(
      `UPDATE subscriptions SET cancelled_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND status = 'active' AND tier != 'free'
       RETURNING id, tier, current_period_end as "periodEnd"`,
      [userId],
    );

    if (!rows[0]) {
      res.status(400).json({ error: { code: 'NO_ACTIVE_SUB', message: 'No active paid subscription to cancel' } });
      return;
    }

    subLogger.info({ userId, tier: rows[0].tier }, 'Subscription cancelled');

    res.json({
      status: 'cancelled',
      message: `Your ${rows[0].tier} subscription has been cancelled. You'll retain access until ${rows[0].periodEnd}.`,
      accessUntil: rows[0].periodEnd,
    });
  } catch (err) {
    next(err);
  }
});

export { subscriptionsRouter };
