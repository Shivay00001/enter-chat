import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { logger } from '../shared/logger.js';
import { getDbPool } from '../shared/db.js';
import { PostgresChatRepository, PostgresMessageRepository } from '../modules/chats/adapters/postgres.js';
import { createAck, createError, createEvent, CLIENT_EVENTS, SERVER_EVENTS } from './protocol.js';
import type { WsMessage } from './protocol.js';

const wsLogger = logger.child({ component: 'websocket' });

/**
 * Authenticated WebSocket connection.
 * Extends WebSocket with user context.
 */
interface AuthenticatedSocket extends WebSocket {
  userId: string;
  deviceId?: string;
  sessionId?: string;
  isAlive: boolean;
}

/** Map of userId → Set of connected sockets */
const connections = new Map<string, Set<AuthenticatedSocket>>();

let wss: WebSocketServer | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the WebSocket server.
 */
export function startWebSocketServer(): WebSocketServer {
  wss = new WebSocketServer({
    port: config.wsPort,
    maxPayload: 64 * 1024, // 64KB max message size
  });

  wsLogger.info({ port: config.wsPort }, `WebSocket server listening on port ${config.wsPort}`);

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    handleConnection(ws as AuthenticatedSocket, req);
  });

  wss.on('error', (err) => {
    wsLogger.error({ err }, 'WebSocket server error');
  });

  // Heartbeat: ping all clients every interval, disconnect stale ones
  heartbeatInterval = setInterval(() => {
    for (const [_userId, sockets] of connections) {
      for (const socket of sockets) {
        if (!socket.isAlive) {
          wsLogger.debug({ userId: socket.userId }, 'Terminating stale WebSocket connection');
          socket.terminate();
          sockets.delete(socket);
          continue;
        }
        socket.isAlive = false;
        socket.ping();
      }
    }

    // Cleanup empty user entries
    for (const [userId, sockets] of connections) {
      if (sockets.size === 0) {
        connections.delete(userId);
      }
    }
  }, config.ws.heartbeatIntervalMs);

  return wss;
}

/**
 * Stop the WebSocket server gracefully.
 */
export async function stopWebSocketServer(): Promise<void> {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  if (wss) {
    // Close all connections
    for (const [, sockets] of connections) {
      for (const socket of sockets) {
        socket.close(1001, 'Server shutting down');
      }
    }
    connections.clear();

    await new Promise<void>((resolve) => {
      wss!.close(() => {
        wsLogger.info('WebSocket server closed');
        resolve();
      });
    });
    wss = null;
  }
}

/**
 * Handle a new WebSocket connection.
 * Authenticates via token query param or Authorization header.
 */
function handleConnection(ws: AuthenticatedSocket, req: IncomingMessage): void {
  // Extract token from query string (?token=xxx) or Authorization header
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const token = url.searchParams.get('token')
    || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (!token) {
    ws.close(4001, 'Missing authentication token');
    return;
  }

  // Verify JWT
  let userId: string;
  let deviceId: string | undefined;
  let sessionId: string | undefined;

  try {
    const payload = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
    }) as Record<string, unknown>;

    if (payload.aud === 'authenticated') {
      // Supabase JWT
      userId = payload.sub as string;
    } else if (payload.iss === config.jwt.issuer) {
      // EnterChat JWT
      userId = payload.sub as string;
      deviceId = payload.deviceId as string | undefined;
      sessionId = payload.sessionId as string | undefined;
    } else {
      ws.close(4001, 'Invalid token');
      return;
    }
  } catch {
    ws.close(4001, 'Invalid or expired token');
    return;
  }

  // Check max connections per user
  const userSockets = connections.get(userId) || new Set();
  if (userSockets.size >= config.ws.maxConnectionsPerUser) {
    // Close the oldest connection
    const oldest = userSockets.values().next().value;
    if (oldest) {
      oldest.close(4002, 'Connection limit exceeded — new connection replacing this one');
      userSockets.delete(oldest);
    }
  }

  // Set up authenticated socket
  ws.userId = userId;
  ws.deviceId = deviceId;
  ws.sessionId = sessionId;
  ws.isAlive = true;

  userSockets.add(ws);
  connections.set(userId, userSockets);

  wsLogger.info({ userId, deviceId, totalConnections: userSockets.size }, 'WebSocket connected');

  // Handle pong (heartbeat response)
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Handle incoming messages
  ws.on('message', (data) => {
    handleMessage(ws, data.toString());
  });

  // Handle close
  ws.on('close', (code, reason) => {
    const sockets = connections.get(ws.userId);
    if (sockets) {
      sockets.delete(ws);
      if (sockets.size === 0) {
        connections.delete(ws.userId);
      }
    }
    wsLogger.debug({ userId: ws.userId, code, reason: reason.toString() }, 'WebSocket disconnected');
  });

  // Handle errors
  ws.on('error', (err) => {
    wsLogger.error({ err, userId: ws.userId }, 'WebSocket error');
  });
}

/**
 * Handle an incoming WebSocket message from a client.
 */
async function handleMessage(ws: AuthenticatedSocket, raw: string): Promise<void> {
  let msg: WsMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    sendToSocket(ws, createError('unknown', 'PARSE_ERROR', 'Invalid JSON'));
    return;
  }

  const requestId = msg.requestId || 'unknown';

  try {
    switch (msg.type) {
      case CLIENT_EVENTS.PING:
        sendToSocket(ws, { type: SERVER_EVENTS.PONG, requestId, serverTime: new Date().toISOString() });
        break;

      case CLIENT_EVENTS.MESSAGE_SEND:
        await handleMessageSend(ws, requestId, msg.payload || {});
        break;

      case CLIENT_EVENTS.MESSAGE_TYPING:
        await handleTyping(ws, requestId, msg.payload || {});
        break;

      case CLIENT_EVENTS.MESSAGE_READ:
        await handleReadReceipt(ws, requestId, msg.payload || {});
        break;

      default:
        sendToSocket(ws, createError(requestId, 'UNKNOWN_TYPE', `Unknown message type: ${msg.type}`));
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Internal error';
    wsLogger.error({ err, type: msg.type, userId: ws.userId }, 'WebSocket message handler error');
    sendToSocket(ws, createError(requestId, 'INTERNAL_ERROR', errMsg));
  }
}

/**
 * Handle message.send — save to DB and broadcast to chat members.
 */
async function handleMessageSend(
  ws: AuthenticatedSocket,
  requestId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const chatId = payload.chatId as string;
  const content = payload.content as string;
  const msgType = (payload.msgType as string) || 'text';

  if (!chatId || !content) {
    sendToSocket(ws, createError(requestId, 'INVALID_PAYLOAD', 'chatId and content are required'));
    return;
  }

  const pool = getDbPool();
  const messageRepo = new PostgresMessageRepository(pool);

  // Save message
  const message = await messageRepo.createMessage({
    chatId,
    senderId: ws.userId,
    content,
    msgType: msgType as 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker' | 'voice_note',
    replyToId: payload.replyToId as string | undefined,
    mediaUrl: payload.mediaUrl as string | undefined,
    mediaMetadata: payload.mediaMetadata as Record<string, unknown> | undefined,
  });

  // Acknowledge to sender
  sendToSocket(ws, createAck(requestId, 'accepted', message?.id));

  // Broadcast to all chat members
  const chatRepo = new PostgresChatRepository(pool);
  const memberIds = await chatRepo.getMemberUserIds(chatId);

  const event = createEvent(SERVER_EVENTS.MESSAGE_NEW, {
    chatId,
    message,
  });

  for (const memberId of memberIds) {
    if (memberId === ws.userId) continue; // Don't echo back to sender
    broadcastToUser(memberId, event);
  }
}

/**
 * Handle typing indicators.
 */
async function handleTyping(
  ws: AuthenticatedSocket,
  requestId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const chatId = payload.chatId as string;
  const isTyping = payload.isTyping !== false;

  if (!chatId) {
    sendToSocket(ws, createError(requestId, 'INVALID_PAYLOAD', 'chatId is required'));
    return;
  }

  // Broadcast typing indicator to chat members
  const pool = getDbPool();
  const chatRepo = new PostgresChatRepository(pool);
  const memberIds = await chatRepo.getMemberUserIds(chatId);

  const event = createEvent(
    isTyping ? SERVER_EVENTS.TYPING_START : SERVER_EVENTS.TYPING_STOP,
    { chatId, userId: ws.userId },
  );

  for (const memberId of memberIds) {
    if (memberId === ws.userId) continue;
    broadcastToUser(memberId, event);
  }

  sendToSocket(ws, createAck(requestId, 'accepted'));
}

/**
 * Handle read receipts — update last_read_at and broadcast.
 */
async function handleReadReceipt(
  ws: AuthenticatedSocket,
  requestId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const chatId = payload.chatId as string;

  if (!chatId) {
    sendToSocket(ws, createError(requestId, 'INVALID_PAYLOAD', 'chatId is required'));
    return;
  }

  const pool = getDbPool();
  const chatRepo = new PostgresChatRepository(pool);

  // Update last_read_at
  await chatRepo.markAsRead(chatId, ws.userId);

  // Broadcast read receipt
  const memberIds = await chatRepo.getMemberUserIds(chatId);
  const event = createEvent(SERVER_EVENTS.READ_RECEIPT, {
    chatId,
    userId: ws.userId,
    readAt: new Date().toISOString(),
  });

  for (const memberId of memberIds) {
    if (memberId === ws.userId) continue;
    broadcastToUser(memberId, event);
  }

  sendToSocket(ws, createAck(requestId, 'accepted'));
}

// --- Helpers ---

/**
 * Send a message to a single socket.
 */
function sendToSocket(ws: WebSocket, message: WsMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Broadcast a message to all connected sockets of a user.
 */
export function broadcastToUser(userId: string, message: WsMessage): void {
  const sockets = connections.get(userId);
  if (!sockets) return;

  const data = JSON.stringify(message);
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    }
  }
}

/**
 * Get count of currently connected users (for monitoring).
 */
export function getConnectedUserCount(): number {
  return connections.size;
}

/**
 * Get total WebSocket connection count (for monitoring).
 */
export function getTotalConnectionCount(): number {
  let total = 0;
  for (const sockets of connections.values()) {
    total += sockets.size;
  }
  return total;
}
