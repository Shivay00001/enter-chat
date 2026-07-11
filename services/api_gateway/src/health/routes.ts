import { Router } from 'express';
import { checkDbHealth } from '../shared/database.js';
import { checkRedisHealth } from '../shared/redis.js';

const healthRouter = Router();

/**
 * Liveness probe — returns 200 if process is running.
 */
healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'api-gateway',
  });
});

/**
 * Readiness probe — returns 200 only if DB and Redis are reachable.
 */
healthRouter.get('/ready', async (_req, res) => {
  const [dbOk, redisOk] = await Promise.all([
    checkDbHealth(),
    checkRedisHealth(),
  ]);

  const isReady = dbOk && redisOk;

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks: {
      database: dbOk ? 'ok' : 'failing',
      redis: redisOk ? 'ok' : 'failing',
    },
  });
});

export { healthRouter };
