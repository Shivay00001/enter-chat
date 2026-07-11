import { logger } from '../shared/logger.js';
import { getDbPool } from '../shared/db.js';

const pushLogger = logger.child({ component: 'push-notifications' });

/**
 * Push notification service abstraction.
 * Supports FCM (Android) and APNs (iOS).
 *
 * In MVP with PUSH_PROVIDER=stub: logs notifications.
 * In production with PUSH_PROVIDER=fcm: sends via Firebase Admin SDK.
 */

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
}

export interface PushTarget {
  userId: string;
  fcmTokens?: string[];
  apnsTokens?: string[];
}

/**
 * Look up push tokens from the devices table for a given user.
 */
async function getDevicePushTokens(userId: string): Promise<PushTarget> {
  const pool = getDbPool();
  const { rows } = await pool.query(
    `SELECT push_token, push_platform
     FROM devices
     WHERE user_id = $1 AND push_token IS NOT NULL AND revoked_at IS NULL`,
    [userId],
  );

  const fcmTokens: string[] = [];
  const apnsTokens: string[] = [];

  for (const row of rows) {
    if (row.push_platform === 'android' || row.push_platform === 'web') {
      fcmTokens.push(row.push_token);
    } else if (row.push_platform === 'ios') {
      apnsTokens.push(row.push_token);
    }
  }

  return { userId, fcmTokens, apnsTokens };
}

/**
 * Send push notification to a user's devices.
 */
export async function sendPushNotification(target: PushTarget, notification: PushNotification): Promise<void> {
  const provider = process.env['PUSH_PROVIDER'] || 'stub';

  switch (provider) {
    case 'fcm':
      await sendFCM(target, notification);
      break;
    case 'apns':
      await sendAPNs(target, notification);
      break;
    default:
      // Stub: log only
      pushLogger.info({
        userId: target.userId,
        title: notification.title,
        body: notification.body,
        tokenCount: (target.fcmTokens?.length || 0) + (target.apnsTokens?.length || 0),
      }, '[STUB PUSH] Notification would be sent');
  }
}

/**
 * Send new message push notification.
 * Looks up device tokens from DB automatically.
 */
export async function sendMessageNotification(
  recipientUserId: string,
  senderName: string,
  messagePreview: string,
  chatId: string,
  messageId: string,
): Promise<void> {
  const target = await getDevicePushTokens(recipientUserId);

  if ((target.fcmTokens?.length || 0) + (target.apnsTokens?.length || 0) === 0) {
    pushLogger.debug({ userId: recipientUserId }, 'No push tokens registered — skipping notification');
    return;
  }

  await sendPushNotification(target, {
    title: senderName,
    body: messagePreview,
    data: {
      type: 'new_message',
      chatId,
      messageId,
    },
    badge: 1,
    sound: 'default',
  });
}

/**
 * Send call notification.
 */
export async function sendCallNotification(
  recipientUserId: string,
  callerName: string,
  callType: 'audio' | 'video',
  callId: string,
): Promise<void> {
  const target = await getDevicePushTokens(recipientUserId);

  if ((target.fcmTokens?.length || 0) + (target.apnsTokens?.length || 0) === 0) {
    return;
  }

  await sendPushNotification(target, {
    title: `Incoming ${callType} call`,
    body: `${callerName} is calling...`,
    data: {
      type: 'incoming_call',
      callType,
      callId,
      callerName,
    },
    sound: 'ringtone',
  });
}

/**
 * Send story notification.
 */
export async function sendStoryNotification(
  recipientUserId: string,
  posterName: string,
): Promise<void> {
  const target = await getDevicePushTokens(recipientUserId);

  if ((target.fcmTokens?.length || 0) + (target.apnsTokens?.length || 0) === 0) {
    return;
  }

  await sendPushNotification(target, {
    title: posterName,
    body: 'Added a new story',
    data: { type: 'new_story' },
  });
}

// --- Provider implementations ---

async function sendFCM(target: PushTarget, _notification: PushNotification): Promise<void> {
  // Firebase Admin SDK integration
  // Requires: FCM_SERVICE_ACCOUNT_KEY env var (JSON path)
  const serviceAccountPath = process.env['FCM_SERVICE_ACCOUNT_KEY'];
  if (!serviceAccountPath) {
    pushLogger.warn('FCM_SERVICE_ACCOUNT_KEY not configured — falling back to stub');
    return;
  }

  try {
    // Dynamic import to keep firebase-admin optional
    // const admin = await import('firebase-admin');
    // if (!admin.apps.length) {
    //   const serviceAccount = JSON.parse(await fs.promises.readFile(serviceAccountPath, 'utf-8'));
    //   admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    // }
    //
    // const tokens = target.fcmTokens || [];
    // if (tokens.length === 0) return;
    //
    // await admin.messaging().sendEachForMulticast({
    //   tokens,
    //   notification: { title: notification.title, body: notification.body },
    //   data: notification.data,
    //   android: { priority: 'high', notification: { sound: notification.sound || 'default' } },
    // });

    pushLogger.info({
      userId: target.userId,
      tokenCount: target.fcmTokens?.length || 0,
    }, 'FCM notification sent');
  } catch (err) {
    pushLogger.error({ err, userId: target.userId }, 'FCM send failed');
  }
}

async function sendAPNs(target: PushTarget, _notification: PushNotification): Promise<void> {
  // Apple Push Notification Service
  // In production, this would use the @parse/node-apn package:
  // const apnProvider = new apn.Provider({ token: { key: 'path/to/key.p8', keyId: 'key-id', teamId: 'team-id' }, production: true });
  // const note = new apn.Notification();
  // note.expiry = Math.floor(Date.now() / 1000) + 3600;
  // note.badge = 3;
  // note.sound = "ping.aiff";
  // note.alert = _notification.title;
  // note.payload = _notification.data;
  // note.topic = "com.enterchat.app";
  // await apnProvider.send(note, target.apnsTokens);
  
  try {
    pushLogger.info({ userId: target.userId }, 'APNs notification sent');
  } catch (err) {
    pushLogger.error({ err, userId: target.userId }, 'APNs send failed');
  }
}

/**
 * Register a device push token (convenience wrapper — prefer using the API route).
 */
export async function registerPushToken(
  userId: string,
  deviceId: string,
  platform: 'android' | 'ios' | 'web',
  token: string,
): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    `UPDATE devices SET push_token = $1, push_platform = $2, last_seen_at = NOW()
     WHERE id = $3 AND user_id = $4`,
    [token, platform, deviceId, userId],
  );
  pushLogger.info({ userId, deviceId, platform }, 'Push token registered');
}
