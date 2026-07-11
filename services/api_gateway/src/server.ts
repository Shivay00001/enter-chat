import express from 'express';
import path from 'node:path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config/index.js';
import { correlationId } from './middleware/correlation-id.js';
import { requestLoggerMiddleware } from './middleware/request-logger.js';
import { generalRateLimiter } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './health/routes.js';
import { authRouter } from './modules/auth/adapters/http/routes.js';
import { usersRouter } from './modules/users/adapters/http/routes.js';
import { chatsRouter } from './modules/chats/adapters/http/routes.js';
import { messagesRouter } from './modules/messages/adapters/http/routes.js';
import { mediaRouter } from './modules/media/adapters/http/routes.js';
import { accountRouter } from './modules/account/adapters/http/routes.js';
import { storiesRouter } from './modules/stories/adapters/http/routes.js';
import { notificationsRouter } from './modules/notifications/adapters/http/routes.js';
import { keysRouter } from './modules/e2ee/adapters/http/routes.js';
import { walletRouter } from './modules/wallet/adapters/http/routes.js';
import { transfersRouter } from './modules/transfers/adapters/http/routes.js';
import { subscriptionsRouter } from './modules/subscriptions/adapters/http/routes.js';
import { storeRouter } from './modules/store/adapters/http/routes.js';
import { adsRouter } from './modules/ads/adapters/http/routes.js';
import { blockedRouter } from './modules/blocked/adapters/http/routes.js';
import { pollsRouter } from './modules/polls/adapters/http/routes.js';
import { presenceRouter } from './modules/presence/adapters/http/routes.js';
import { pinsRouter } from './modules/pins/adapters/http/routes.js';
import { foldersRouter } from './modules/folders/adapters/http/routes.js';
import { scheduledRouter } from './modules/scheduled/adapters/http/routes.js';
import { getPrometheusMetrics, getMetrics, startMetricsReporter } from './services/monitoring.js';

export function createApp(): express.Application {
  const app = express();

  // --- Security middleware ---
  app.use(helmet({
    contentSecurityPolicy: config.nodeEnv === 'production' ? undefined : false,
  }));
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(compression());

  // --- Request parsing ---
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  // --- Request infrastructure ---
  app.use(correlationId);
  app.use(requestLoggerMiddleware);
  app.use(generalRateLimiter);

  // Trust proxy for correct IP behind load balancer
  app.set('trust proxy', 1);

  // --- Routes ---
  app.use(healthRouter);
  app.use('/v1/auth', authRouter);
  app.use('/v1/users', usersRouter);
  app.use('/v1/chats', chatsRouter);
  app.use('/v1/stories', storiesRouter);
  app.use('/v1/chats', messagesRouter); // Messages are nested under /chats/:chatId/messages
  app.use('/v1/media', mediaRouter);
  app.use('/v1/account', accountRouter); // Delete account, data export
  app.use('/v1/notifications', notificationsRouter);
  app.use('/v1/keys', keysRouter);
  app.use('/v1/wallet', walletRouter);
  app.use('/v1/transfers', transfersRouter);
  app.use('/v1/subscriptions', subscriptionsRouter);
  app.use('/v1/store', storeRouter);
  app.use('/v1/ads', adsRouter);

  // --- Competitor-inspired features ---
  app.use('/v1/blocked', blockedRouter);          // Block/unblock users
  app.use('/v1/polls', pollsRouter);              // In-chat polls
  app.use('/v1/presence', presenceRouter);         // Online/last seen status
  app.use('/v1/chats', pinsRouter);               // Pinned messages (/chats/:chatId/pins)
  app.use('/v1/folders', foldersRouter);           // Chat folders
  app.use('/v1/scheduled', scheduledRouter);       // Scheduled messages

  // Also mount messages at /v1/messages for edit/delete
  app.use('/v1/messages', messagesRouter);

  // Serve uploaded media files (local storage only)
  if (config.media.storageProvider === 'local') {
    app.use('/media/files', express.static(path.resolve(config.media.localPath)));
  }

  // --- Metrics endpoints (protected in production) ---
  const metricsAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (config.nodeEnv !== 'production') {
      next();
      return;
    }
    const metricsToken = process.env['METRICS_TOKEN'];
    if (!metricsToken) {
      // No token configured — block all access in production
      res.status(403).json({ error: 'Metrics access denied' });
      return;
    }
    const provided = req.headers['x-metrics-token'] as string
      || req.query['token'] as string;
    if (provided !== metricsToken) {
      res.status(403).json({ error: 'Invalid metrics token' });
      return;
    }
    next();
  };

  app.get('/metrics', metricsAuth, (_req, res) => {
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(getPrometheusMetrics());
  });

  app.get('/metrics/json', metricsAuth, (_req, res) => {
    res.json(getMetrics());
  });

  // Start metrics reporter
  if (config.nodeEnv === 'production') {
    startMetricsReporter();
  }

  // --- 404 handler ---
  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
      },
    });
  });

  // --- Error handler (must be last) ---
  app.use(errorHandler);

  return app;
}
