import { redis } from '../shared/redis.js';
import { logger } from '../shared/logger.js';

const cacheLogger = logger.child({ component: 'cache' });

/**
 * Redis caching layer.
 * CONSOLIDATED: Uses the shared ioredis client from shared/redis.ts
 * instead of creating a separate node-redis client.
 */
export class CacheService {
  private get isConnected(): boolean {
    return redis.status === 'ready';
  }

  async connect(_redisUrl?: string): Promise<void> {
    // Connection is handled by shared/redis.ts (lazy connect).
    // This method exists for backward compatibility.
    if (redis.status === 'wait') {
      try {
        await redis.connect();
        cacheLogger.info('CacheService connected via shared ioredis client');
      } catch (err) {
        cacheLogger.warn({ err }, 'CacheService connection failed — running without cache');
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) return null;
    try {
      const raw = await redis.get(this.prefixKey(key));
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      cacheLogger.error({ err, key }, 'Cache get failed');
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.isConnected) return;
    try {
      await redis.set(this.prefixKey(key), JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      cacheLogger.error({ err, key }, 'Cache set failed');
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      await redis.del(this.prefixKey(key));
    } catch (err) {
      cacheLogger.error({ err, key }, 'Cache del failed');
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      const keys = await redis.keys(this.prefixKey(pattern));
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      cacheLogger.error({ err, pattern }, 'Cache del pattern failed');
    }
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      const prefixed = this.prefixKey(key);
      const val = await redis.incr(prefixed);
      if (val === 1) {
        await redis.expire(prefixed, ttlSeconds);
      }
      return val;
    } catch (err) {
      cacheLogger.error({ err, key }, 'Cache increment failed');
      return 0;
    }
  }

  // --- Typed cache helpers ---

  async cacheUserProfile(userId: string, profile: Record<string, unknown>): Promise<void> {
    await this.set(`user:profile:${userId}`, profile, 300);
  }

  async getUserProfile(userId: string): Promise<Record<string, unknown> | null> {
    return this.get(`user:profile:${userId}`);
  }

  async invalidateUserProfile(userId: string): Promise<void> {
    await this.del(`user:profile:${userId}`);
  }

  async cacheChatMeta(chatId: string, meta: Record<string, unknown>): Promise<void> {
    await this.set(`chat:meta:${chatId}`, meta, 120);
  }

  async getChatMeta(chatId: string): Promise<Record<string, unknown> | null> {
    return this.get(`chat:meta:${chatId}`);
  }

  async cacheUnreadCount(userId: string, chatId: string, count: number): Promise<void> {
    await this.set(`unread:${userId}:${chatId}`, count, 30);
  }

  async checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
    const count = await this.increment(`ratelimit:${key}`, windowSeconds);
    return count <= maxRequests;
  }

  async cacheSession(sessionId: string, data: Record<string, unknown>, ttlSeconds = 900): Promise<void> {
    await this.set(`session:${sessionId}`, data, ttlSeconds);
  }

  async getSession(sessionId: string): Promise<Record<string, unknown> | null> {
    return this.get(`session:${sessionId}`);
  }

  async invalidateSession(sessionId: string): Promise<void> {
    await this.del(`session:${sessionId}`);
  }

  private prefixKey(key: string): string {
    return `ec:${key}`;
  }

  async disconnect(): Promise<void> {
    // Don't disconnect the shared client — it's managed by index.ts shutdown
  }
}

let cacheService: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!cacheService) {
    cacheService = new CacheService();
  }
  return cacheService;
}
