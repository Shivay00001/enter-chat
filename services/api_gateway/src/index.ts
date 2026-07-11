import { createApp } from './server.js';
import { config } from './config/index.js';
import { logger } from './shared/logger.js';
import { redis } from './shared/redis.js';
import { pool } from './shared/database.js';
import { startWebSocketServer, stopWebSocketServer } from './websocket/ws-server.js';

const appLogger = logger.child({ component: 'startup' });

async function main(): Promise<void> {
  // Connect to Redis
  try {
    await redis.connect();
    appLogger.info('Redis connected');
  } catch (err) {
    appLogger.warn({ err }, 'Redis connection failed — continuing without Redis');
  }

  // Test database connection
  try {
    await pool.query('SELECT 1');
    appLogger.info('PostgreSQL connected');
  } catch (err) {
    appLogger.warn({ err }, 'PostgreSQL connection failed — continuing with in-memory stores');
  }

  // Start HTTP server
  const app = createApp();
  const httpServer = app.listen(config.port, () => {
    appLogger.info({ port: config.port }, `API server listening on port ${config.port}`);
  });

  // Start WebSocket server
  startWebSocketServer();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    appLogger.info({ signal }, 'Shutdown signal received');

    httpServer.close(() => appLogger.info('HTTP server closed'));

    await stopWebSocketServer();
    await redis.quit().catch(() => {});
    await pool.end().catch(() => {});

    appLogger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    appLogger.error({ reason }, 'Unhandled rejection');
  });

  process.on('uncaughtException', (err) => {
    appLogger.fatal({ err }, 'Uncaught exception — shutting down');
    process.exit(1);
  });
}

main().catch((err) => {
  appLogger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
