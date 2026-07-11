import { Router } from 'express';
import { authMiddleware } from '../../../../middleware/auth.js';
import { getDbPool } from '../../../../shared/db.js';
import { logger } from '../../../../shared/logger.js';
import { PostgresWalletRepository } from '../../../wallet/adapters/postgres.js';

const storeLogger = logger.child({ component: 'sticker-store' });
const storeRouter = Router();

// --- GET /v1/store/stickers ---
// Browse sticker packs (with category filter).
storeRouter.get('/stickers', authMiddleware, async (req, res, next) => {
  try {
    const category = req.query['category'] as string;
    const free = req.query['free'] === 'true';
    const limit = Math.min(parseInt(req.query['limit'] as string) || 50, 100);
    const offset = parseInt(req.query['offset'] as string) || 0;

    const pool = getDbPool();
    const params: unknown[] = [];
    const conditions: string[] = ['sp.is_active = true'];

    if (category) {
      params.push(category);
      conditions.push(`sp.category = $${params.length}`);
    }
    if (free) {
      conditions.push('sp.price_inr = 0');
    }

    params.push(limit, offset);

    const { rows } = await pool.query(
      `SELECT sp.id, sp.name, sp.description, sp.artist, sp.thumbnail_url as "thumbnailUrl",
              sp.sticker_count as "stickerCount", sp.price_inr as "priceInr", sp.price_usd as "priceUsd",
              sp.is_animated as "isAnimated", sp.is_premium as "isPremium",
              sp.category, sp.download_count as "downloadCount",
              sp.created_at as "createdAt"
       FROM sticker_packs sp
       WHERE ${conditions.join(' AND ')}
       ORDER BY sp.download_count DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    res.json({
      packs: rows.map(p => ({
        ...p,
        priceInr: parseInt(p.priceInr, 10),
        priceUsd: parseInt(p.priceUsd, 10),
        isFree: parseInt(p.priceInr, 10) === 0,
        priceFormatted: parseInt(p.priceInr, 10) === 0 ? 'Free' : `₹${(parseInt(p.priceInr, 10) / 100).toFixed(0)}`,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// --- GET /v1/store/stickers/:packId ---
// Get sticker pack details with previews.
storeRouter.get('/stickers/:packId', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const packId = req.params['packId'] as string;
    const pool = getDbPool();

    const { rows } = await pool.query(
      `SELECT sp.id, sp.name, sp.description, sp.artist, sp.thumbnail_url as "thumbnailUrl",
              sp.preview_urls as "previewUrls", sp.sticker_count as "stickerCount",
              sp.price_inr as "priceInr", sp.price_usd as "priceUsd",
              sp.is_animated as "isAnimated", sp.is_premium as "isPremium",
              sp.category, sp.download_count as "downloadCount",
              EXISTS(SELECT 1 FROM sticker_pack_purchases WHERE pack_id = sp.id AND user_id = $2) as "owned"
       FROM sticker_packs sp
       WHERE sp.id = $1 AND sp.is_active = true`,
      [packId, userId],
    );

    if (!rows[0]) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Sticker pack not found' } });
      return;
    }

    res.json({
      pack: {
        ...rows[0],
        priceInr: parseInt(rows[0].priceInr, 10),
        priceUsd: parseInt(rows[0].priceUsd, 10),
        isFree: parseInt(rows[0].priceInr, 10) === 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// --- POST /v1/store/stickers/:packId/purchase ---
// Purchase a sticker pack (from wallet).
storeRouter.post('/stickers/:packId/purchase', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const packId = req.params['packId'] as string;
    const pool = getDbPool();

    // Get pack details
    const { rows: packs } = await pool.query(
      `SELECT id, name, price_inr, is_premium FROM sticker_packs WHERE id = $1 AND is_active = true`,
      [packId],
    );
    if (!packs[0]) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Sticker pack not found' } });
      return;
    }

    const pack = packs[0];
    const price = parseInt(pack.price_inr, 10);

    // Check if already owned
    const { rows: owned } = await pool.query(
      `SELECT id FROM sticker_pack_purchases WHERE user_id = $1 AND pack_id = $2`,
      [userId, packId],
    );
    if (owned[0]) {
      res.status(400).json({ error: { code: 'ALREADY_OWNED', message: 'You already own this sticker pack' } });
      return;
    }

    // If premium-only, check subscription
    if (pack.is_premium) {
      const { rows: sub } = await pool.query(
        `SELECT tier FROM subscriptions WHERE user_id = $1 AND status = 'active' AND tier IN ('premium', 'business')`,
        [userId],
      );
      if (!sub[0]) {
        res.status(403).json({ error: { code: 'PREMIUM_REQUIRED', message: 'This pack requires a Premium subscription' } });
        return;
      }
    }

    // Charge from wallet (if not free)
    if (price > 0) {
      const walletRepo = new PostgresWalletRepository(pool);
      try {
        await walletRepo.debit({
          userId,
          amount: price,
          source: 'sticker_purchase',
          referenceId: packId,
          description: `Sticker pack: ${pack.name}`,
        });
      } catch (err: any) {
        if (err.message === 'INSUFFICIENT_BALANCE') {
          res.status(400).json({ error: { code: 'INSUFFICIENT_BALANCE', message: 'Not enough wallet balance' } });
          return;
        }
        throw err;
      }
    }

    // Record purchase
    await pool.query(
      `INSERT INTO sticker_pack_purchases (user_id, pack_id) VALUES ($1, $2)
       ON CONFLICT (user_id, pack_id) DO NOTHING`,
      [userId, packId],
    );

    // Increment download count
    await pool.query(
      `UPDATE sticker_packs SET download_count = download_count + 1 WHERE id = $1`,
      [packId],
    );

    storeLogger.info({ userId, packId, price }, 'Sticker pack purchased');

    res.json({
      status: 'purchased',
      packId,
      packName: pack.name,
    });
  } catch (err) {
    next(err);
  }
});

// --- GET /v1/store/stickers/my-packs ---
// Get user's owned sticker packs.
storeRouter.get('/my-packs', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const pool = getDbPool();

    const { rows } = await pool.query(
      `SELECT sp.id, sp.name, sp.description, sp.artist, sp.thumbnail_url as "thumbnailUrl",
              sp.preview_urls as "previewUrls", sp.sticker_count as "stickerCount",
              sp.is_animated as "isAnimated", sp.category,
              spp.purchased_at as "purchasedAt"
       FROM sticker_pack_purchases spp
       JOIN sticker_packs sp ON sp.id = spp.pack_id
       WHERE spp.user_id = $1
       ORDER BY spp.purchased_at DESC`,
      [userId],
    );

    res.json({ packs: rows });
  } catch (err) {
    next(err);
  }
});

export { storeRouter };
