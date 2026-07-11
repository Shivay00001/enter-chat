/**
 * WebSocket message protocol for EnterChat.
 * Defines the wire format for all WebSocket communication.
 *
 * Client → Server: { type, requestId, payload }
 * Server → Client: { type, requestId?, payload?, serverTime }
 */

export interface WsMessage {
  type: string;
  requestId?: string;
  payload?: Record<string, unknown>;
  serverTime?: string;
  status?: string;
  cursor?: string;
}

/**
 * Create an acknowledgement message for a client request.
 */
export function createAck(requestId: string, status: string, cursor?: string): WsMessage {
  return {
    type: 'ack',
    requestId,
    status,
    cursor,
    serverTime: new Date().toISOString(),
  };
}

/**
 * Create an error response for a client request.
 */
export function createError(requestId: string, code: string, message: string): WsMessage {
  return {
    type: 'error',
    requestId,
    payload: { code, message },
    serverTime: new Date().toISOString(),
  };
}

/**
 * Create a server-initiated event (broadcast).
 */
export function createEvent(type: string, payload: Record<string, unknown>): WsMessage {
  return {
    type,
    payload,
    serverTime: new Date().toISOString(),
  };
}

// --- Client message types ---
export const CLIENT_EVENTS = {
  MESSAGE_SEND: 'message.send',
  MESSAGE_TYPING: 'message.typing',
  MESSAGE_READ: 'message.read',
  PING: 'ping',
  // Competitor-inspired
  PRESENCE_UPDATE: 'presence.update',
  POLL_VOTE: 'poll.vote',
} as const;

// --- Server event types ---
export const SERVER_EVENTS = {
  MESSAGE_NEW: 'message.new',
  MESSAGE_EDITED: 'message.edited',
  MESSAGE_DELETED: 'message.deleted',
  MESSAGE_REACTION: 'message.reaction',
  TYPING_START: 'typing.start',
  TYPING_STOP: 'typing.stop',
  READ_RECEIPT: 'read.receipt',
  PRESENCE_UPDATE: 'presence.update',
  PONG: 'pong',
  // Competitor-inspired
  MESSAGE_PINNED: 'message.pinned',
  MESSAGE_UNPINNED: 'message.unpinned',
  POLL_UPDATE: 'poll.update',
  POLL_CLOSED: 'poll.closed',
  MESSAGE_DISAPPEARED: 'message.disappeared',
  USER_BLOCKED: 'user.blocked',
  USER_UNBLOCKED: 'user.unblocked',
  CALL_OFFER: 'call.offer',
  CALL_ANSWER: 'call.answer',
  CALL_ICE_CANDIDATE: 'call.ice_candidate',
  CALL_END: 'call.end',
} as const;
