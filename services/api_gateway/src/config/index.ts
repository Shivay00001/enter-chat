import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  // General
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  port: z.coerce.number().int().positive().default(3000),
  wsPort: z.coerce.number().int().positive().default(3001),

  // PostgreSQL
  db: z.object({
    host: z.string().min(1).default('localhost'),
    port: z.coerce.number().int().positive().default(5432),
    name: z.string().min(1).default('enterchat'),
    user: z.string().min(1).default('enterchat'),
    password: z.string().min(1),
    ssl: z.coerce.boolean().default(false),
    poolMin: z.coerce.number().int().min(1).default(2),
    poolMax: z.coerce.number().int().min(1).default(10),
  }),

  // Redis
  redis: z.object({
    host: z.string().min(1).default('localhost'),
    port: z.coerce.number().int().positive().default(6379),
    password: z.string().optional().default(''),
    db: z.coerce.number().int().min(0).default(0),
  }),

  // JWT
  jwt: z.object({
    secret: z.string().min(32),
    accessTokenExpiry: z.string().default('15m'),
    refreshTokenExpiry: z.string().default('30d'),
    issuer: z.string().default('enterchat'),
  }),

  // OTP
  otp: z.object({
    length: z.coerce.number().int().min(4).max(8).default(6),
    expirySeconds: z.coerce.number().int().positive().default(300),
    maxAttempts: z.coerce.number().int().positive().default(5),
    smsProvider: z.enum(['stub', 'twilio', 'aws_sns']).default('stub'),
  }),

  // Auth / SMS SDKs
  auth: z.object({
    twilioAccountSid: z.string().optional().default(''),
    twilioAuthToken: z.string().optional().default(''),
    twilioFromNumber: z.string().optional().default(''),
    awsRegion: z.string().optional().default(''),
    awsAccessKeyId: z.string().optional().default(''),
    awsSecretAccessKey: z.string().optional().default(''),
  }),

  // Rate Limiting
  rateLimit: z.object({
    windowMs: z.coerce.number().int().positive().default(60000),
    maxRequests: z.coerce.number().int().positive().default(100),
    otpStartMax: z.coerce.number().int().positive().default(5),
    otpVerifyMax: z.coerce.number().int().positive().default(10),
  }),

  // Media
  media: z.object({
    storageProvider: z.enum(['local', 's3', 'r2']).default('local'),
    localPath: z.string().default('./uploads'),
    maxFileSizeMb: z.coerce.number().positive().default(100),
    s3: z.object({
      bucket: z.string().default(''),
      region: z.string().default('us-east-1'),
      endpoint: z.string().default(''),
      accessKeyId: z.string().default(''),
      secretAccessKey: z.string().default(''),
      publicUrlPrefix: z.string().default(''),
    }),
  }),

  // Push Notifications
  push: z.object({
    provider: z.enum(['stub', 'fcm', 'apns']).default('stub'),
    fcmServiceAccountKey: z.string().optional().default(''),
    apnsKeyId: z.string().optional().default(''),
    apnsTeamId: z.string().optional().default(''),
  }),

  // CORS
  corsOrigin: z.string().default('http://localhost:3000'),

  // WebSocket
  ws: z.object({
    heartbeatIntervalMs: z.coerce.number().int().positive().default(30000),
    heartbeatTimeoutMs: z.coerce.number().int().positive().default(60000),
    maxConnectionsPerUser: z.coerce.number().int().positive().default(5),
  }),

  // Message Limits
  message: z.object({
    maxLength: z.coerce.number().int().positive().default(10000),
    maxMediaAttachments: z.coerce.number().int().positive().default(10),
  }),

  // Payment Gateway
  payment: z.object({
    provider: z.enum(['stub', 'razorpay', 'stripe']).default('stub'),
    razorpayKeyId: z.string().optional().default(''),
    razorpayKeySecret: z.string().optional().default(''),
    stripeSecretKey: z.string().optional().default(''),
    stripeWebhookSecret: z.string().optional().default(''),
  }),

  // Subscriptions
  subscription: z.object({
    freeTierDeviceLimit: z.coerce.number().int().positive().default(1),
    premiumMonthlyInr: z.coerce.number().int().default(9900),  // ₹99 in paisa
    premiumMonthlyUsd: z.coerce.number().int().default(299),    // $2.99 in cents
  }),
});

export type AppConfig = z.infer<typeof configSchema>;

function loadConfig(): AppConfig {
  // Provide test-safe defaults when running in test mode
  const isTest = process.env['NODE_ENV'] === 'test';

  const raw = {
    nodeEnv: process.env['NODE_ENV'] || (isTest ? 'test' : undefined),
    logLevel: process.env['LOG_LEVEL'],
    port: process.env['PORT'],
    wsPort: process.env['WS_PORT'],
    db: {
      host: process.env['DB_HOST'],
      port: process.env['DB_PORT'],
      name: process.env['DB_NAME'],
      user: process.env['DB_USER'],
      password: process.env['DB_PASSWORD'] || (isTest ? 'test_password' : undefined),
      ssl: process.env['DB_SSL'],
      poolMin: process.env['DB_POOL_MIN'],
      poolMax: process.env['DB_POOL_MAX'],
    },
    redis: {
      host: process.env['REDIS_HOST'],
      port: process.env['REDIS_PORT'],
      password: process.env['REDIS_PASSWORD'],
      db: process.env['REDIS_DB'],
    },
    jwt: {
      secret: process.env['JWT_SECRET'] || (isTest ? 'test_jwt_secret_minimum_32_characters_long' : undefined),
      accessTokenExpiry: process.env['JWT_ACCESS_TOKEN_EXPIRY'],
      refreshTokenExpiry: process.env['JWT_REFRESH_TOKEN_EXPIRY'],
      issuer: process.env['JWT_ISSUER'],
    },
    otp: {
      length: process.env['OTP_LENGTH'],
      expirySeconds: process.env['OTP_EXPIRY_SECONDS'],
      maxAttempts: process.env['OTP_MAX_ATTEMPTS'],
      smsProvider: process.env['OTP_SMS_PROVIDER'],
    },
    auth: {
      twilioAccountSid: process.env['TWILIO_ACCOUNT_SID'],
      twilioAuthToken: process.env['TWILIO_AUTH_TOKEN'],
      twilioFromNumber: process.env['TWILIO_FROM_NUMBER'],
      awsRegion: process.env['AWS_REGION'],
      awsAccessKeyId: process.env['AWS_ACCESS_KEY_ID'],
      awsSecretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'],
    },
    rateLimit: {
      windowMs: process.env['RATE_LIMIT_WINDOW_MS'],
      maxRequests: process.env['RATE_LIMIT_MAX_REQUESTS'],
      otpStartMax: process.env['RATE_LIMIT_OTP_START_MAX'],
      otpVerifyMax: process.env['RATE_LIMIT_OTP_VERIFY_MAX'],
    },
    media: {
      storageProvider: process.env['MEDIA_STORAGE_PROVIDER'] || 'local', // 'local', 's3', 'r2'
      localPath: process.env['MEDIA_LOCAL_PATH'] || './uploads',
      maxFileSizeMb: parseInt(process.env['MEDIA_MAX_FILE_SIZE_MB'] || '50', 10),
      s3: {
        bucket: process.env['S3_BUCKET'] || '',
        region: process.env['S3_REGION'] || 'us-east-1',
        endpoint: process.env['S3_ENDPOINT'] || '', // Required for Cloudflare R2
        accessKeyId: process.env['S3_ACCESS_KEY_ID'] || '',
        secretAccessKey: process.env['S3_SECRET_ACCESS_KEY'] || '',
        publicUrlPrefix: process.env['S3_PUBLIC_URL_PREFIX'] || '', // e.g. https://pub-xxx.r2.dev
      }
    },
    push: {
      provider: process.env['PUSH_PROVIDER'],
      fcmServiceAccountKey: process.env['FCM_SERVICE_ACCOUNT_KEY'],
      apnsKeyId: process.env['APNS_KEY_ID'],
      apnsTeamId: process.env['APNS_TEAM_ID'],
    },
    corsOrigin: process.env['CORS_ORIGIN'],
    ws: {
      heartbeatIntervalMs: process.env['WS_HEARTBEAT_INTERVAL_MS'],
      heartbeatTimeoutMs: process.env['WS_HEARTBEAT_TIMEOUT_MS'],
      maxConnectionsPerUser: process.env['WS_MAX_CONNECTIONS_PER_USER'],
    },
    message: {
      maxLength: process.env['MESSAGE_MAX_LENGTH'],
      maxMediaAttachments: process.env['MESSAGE_MAX_MEDIA_ATTACHMENTS'],
    },
    payment: {
      provider: process.env['PAYMENT_PROVIDER'],
      razorpayKeyId: process.env['RAZORPAY_KEY_ID'],
      razorpayKeySecret: process.env['RAZORPAY_KEY_SECRET'],
      stripeSecretKey: process.env['STRIPE_SECRET_KEY'],
      stripeWebhookSecret: process.env['STRIPE_WEBHOOK_SECRET'],
    },
    subscription: {
      freeTierDeviceLimit: process.env['SUBSCRIPTION_FREE_DEVICE_LIMIT'],
      premiumMonthlyInr: process.env['SUBSCRIPTION_PREMIUM_MONTHLY_INR'],
      premiumMonthlyUsd: process.env['SUBSCRIPTION_PREMIUM_MONTHLY_USD'],
    },
  };

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const msg = `Invalid configuration: ${JSON.stringify(result.error.format())}`;
    console.error('❌', msg);
    // Throw instead of process.exit so tests can catch the failure
    throw new Error(msg);
  }
  return result.data;
}

export const config = loadConfig();

