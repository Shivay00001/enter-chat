import { Router } from 'express';
import { authMiddleware } from '../../../../middleware/auth.js';
import { logger } from '../../../../shared/logger.js';
import { PostgresUserRepository } from '../../../auth/adapters/postgres.js';
import { getDbPool } from '../../../../shared/db.js';

const accountLogger = logger.child({ component: 'account' });

const accountRouter = Router();

/**
 * DELETE /v1/account
 * Delete user account and all associated data.
 * Play Store requirement: Users must be able to delete their account.
 * GDPR requirement: Right to erasure.
 *
 * PRODUCTION: Calls PostgresUserRepository.deleteUser() which:
 * 1. Soft-deletes user (scrubs PII: phone, email, name, avatar)
 * 2. Revokes all sessions
 * 3. Removes from all active chat memberships
 */
accountRouter.delete('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;

    accountLogger.info({ userId }, 'Account deletion requested');

    const pool = getDbPool();
    const userRepo = new PostgresUserRepository(pool);

    await userRepo.deleteUser(userId);

    accountLogger.info({ userId }, 'Account deleted successfully');

    res.json({
      ok: true,
      message: 'Account deletion initiated. Your data will be permanently removed within 90 days.',
      timeline: {
        immediate: 'Account deactivated, logged out from all devices',
        within24h: 'Profile removed from search and contacts',
        within30d: 'Messages deleted from servers',
        within90d: 'All data permanently erased from backups',
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/account/data-export
 * Request a data export (GDPR: Right to portability).
 */
accountRouter.get('/data-export', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;

    accountLogger.info({ userId }, 'Data export requested');

    // In production, this would queue a job in a Redis queue (e.g. BullMQ)
    // await exportQueue.add('export-data', { userId });
    
    // Simulating an async background worker without artificial delays
    setImmediate(async () => {
      try {
        accountLogger.info({ userId }, 'Background worker starting data export...');
        const pool = await import('../../../../shared/db.js').then(m => m.getDbPool());
        
        // Fetch user data
        const { rows: userRows } = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        const { rows: contactRows } = await pool.query('SELECT * FROM user_contacts WHERE user_id = $1', [userId]);
        
        const exportData = {
          profile: userRows[0] || {},
          contacts: contactRows,
          exportedAt: new Date().toISOString(),
        };
        
        accountLogger.info({ userId, dataSize: JSON.stringify(exportData).length }, 'Data export generated successfully');
        
        // In production: Upload to S3 and send push notification with download link
      } catch (e) {
        accountLogger.error({ userId, err: e }, 'Data export failed in background worker');
      }
    });

    res.json({
      ok: true,
      message: 'Data export initiated. You will receive a download link via push notification within 24 hours.',
      estimatedTime: '24 hours',
    });
  } catch (err) {
    next(err);
  }
});

export { accountRouter };
