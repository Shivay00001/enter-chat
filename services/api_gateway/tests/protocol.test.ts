import { describe, it, expect } from 'vitest';
import { createAck, createError, createEvent } from '../src/websocket/protocol.js';

describe('WebSocket Protocol', () => {
  describe('createAck', () => {
    it('should create an ack message with request ID', () => {
      const ack = createAck('req-123', 'accepted');
      expect(ack.type).toBe('ack');
      expect(ack.requestId).toBe('req-123');
      expect(ack.status).toBe('accepted');
      expect(ack.serverTime).toBeDefined();
    });

    it('should create ack with custom cursor', () => {
      const ack = createAck('req-456', 'accepted', 'cursor-abc');
      expect(ack.cursor).toBe('cursor-abc');
    });
  });

  describe('createError', () => {
    it('should create an error message with code and message', () => {
      const err = createError('req-789', 'PARSE_ERROR', 'Invalid JSON');
      expect(err.type).toBe('error');
      expect(err.requestId).toBe('req-789');
      expect(err.payload?.code).toBe('PARSE_ERROR');
      expect(err.payload?.message).toBe('Invalid JSON');
      expect(err.serverTime).toBeDefined();
    });
  });

  describe('createEvent', () => {
    it('should create a server event with payload', () => {
      const event = createEvent('message.new', { chatId: 'chat-1', body: 'Hello' });
      expect(event.type).toBe('message.new');
      expect(event.payload?.chatId).toBe('chat-1');
      expect(event.payload?.body).toBe('Hello');
      expect(event.serverTime).toBeDefined();
    });
  });
});
