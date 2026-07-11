import pino from 'pino';
import { config } from '../config/index.js';

/**
 * Structured JSON logger.
 * SECURITY: Never log OTPs, tokens, secrets, private keys, or message plaintext.
 * Use logger.child({ component: 'auth' }) for module-scoped logging.
 */
export const logger = pino({
  level: config.logLevel,
  transport: config.nodeEnv === 'development'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : undefined,
  base: {
    service: 'api-gateway',
    env: config.nodeEnv,
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  // Redact sensitive fields from logs
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'refreshToken',
      'otp',
      'secret',
      'privateKey',
      'accessToken',
    ],
    censor: '[REDACTED]',
  },
});
