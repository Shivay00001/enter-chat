import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../../../middleware/auth.js';
import { getDbPool } from '../../../../shared/db.js';
import { logger } from '../../../../shared/logger.js';

const adsLogger = logger.child({ component: 'ads' });
const adsRouter = Router();

/**
 * Non-intrusive ad system — Telegram-style.
 * Rules:
 * - NEVER show ads in DMs or group chats
 * - Only in: public channels, between stories, sticker suggestions
 * - Premium/Business users: ZERO ads
 * - Contextual, non-disruptive placements only
 */


// --- GET /v1/ads/placement ---
// Get a contextual ad for a specific placement zone.

adsRouter.get('/placement', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const zone = req.query['zone'] as string;
    const region = req.query['region'] as string;

    if (!zone) {
      res.status(400).json({ error: { code: 'ZONE_REQUIRED', message: 'Placement zone is required' } });
      return;
    }

    const pool = getDbPool();

    // Check if user has premium subscription — NO ADS for premium
    const { rows: subs } = await pool.query(
      `SELECT tier FROM subscriptions
       WHERE user_id = $1 AND status = 'active' AND tier IN ('premium', 'business')`,
      [userId],
    );

    if (subs[0]) {
      // Premium user — no ads ever
      res.json({ ad: null, reason: 'premium_user' });
      return;
    }

    // Fetch a random active ad for the zone
    const params: unknown[] = [zone];
    let regionFilter = '';
    if (region) {
      params.push(region);
      regionFilter = `AND (ap.target_regions = '[]'::jsonb OR ap.target_regions @> to_jsonb($${params.length}::text))`;
    }

    const { rows: ads } = await pool.query(
      `SELECT ap.id, ap.title, ap.body, ap.image_url as "imageUrl",
              ap.action_url as "actionUrl", ap.advertiser, ap.placement_zone as "zone"
       FROM ad_placements ap
       WHERE ap.is_active = true
         AND ap.placement_zone = $1
         AND (ap.starts_at IS NULL OR ap.starts_at <= NOW())
         AND (ap.ends_at IS NULL OR ap.ends_at > NOW())
         ${regionFilter}
       ORDER BY RANDOM()
       LIMIT 1`,
      params,
    );

    if (!ads[0]) {
      res.json({ ad: null });
      return;
    }

    res.json({
      ad: {
        ...ads[0],
        sponsored: true,
        dismissible: true, // User can always dismiss
      },
    });
  } catch (err) {
    next(err);
  }
});

// --- POST /v1/ads/impression ---
// Track ad impression.
const impressionSchema = z.object({
  adId: z.string().uuid(),
  zone: z.string().max(30),
});

adsRouter.post('/impression', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = impressionSchema.parse(req.body);
    const pool = getDbPool();

    // Record impression
    await pool.query(
      `INSERT INTO ad_impressions (ad_id, user_id, placement_zone, action, created_at)
       VALUES ($1, $2, $3, 'view', NOW())`,
      [body.adId, userId, body.zone],
    );

    // Increment counter
    await pool.query(
      `UPDATE ad_placements SET impressions = impressions + 1 WHERE id = $1`,
      [body.adId],
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- POST /v1/ads/click ---
// Track ad click.
const clickSchema = z.object({
  adId: z.string().uuid(),
  zone: z.string().max(30),
});

adsRouter.post('/click', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = clickSchema.parse(req.body);
    const pool = getDbPool();

    // Record click
    await pool.query(
      `INSERT INTO ad_impressions (ad_id, user_id, placement_zone, action, created_at)
       VALUES ($1, $2, $3, 'click', NOW())`,
      [body.adId, userId, body.zone],
    );

    // Increment counter
    await pool.query(
      `UPDATE ad_placements SET clicks = clicks + 1 WHERE id = $1`,
      [body.adId],
    );

    adsLogger.debug({ adId: body.adId, userId }, 'Ad clicked');

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export { adsRouter };
