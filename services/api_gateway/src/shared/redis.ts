import Redis from 'ioredis';
import { config } from '../config/index.js';
import { logger } from './logger.js';

const redisLogger = logger.child({ component: 'redis' });

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  db: config.redis.db,
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 5000);
    redisLogger.warn({ attempt: times, delayMs: delay }, 'Redis reconnecting');
    return delay;
  },
  lazyConnect: true,
});

redis.on('connect', () => {
  redisLogger.info('Redis connected');
});

redis.on('error', (err) => {
  redisLogger.error({ err }, 'Redis connection error');
});

redis.on('close', () => {
  redisLogger.warn('Redis connection closed');
});

/**
 * Check Redis connectivity (for health/readiness).
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}
