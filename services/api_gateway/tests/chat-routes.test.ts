import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/server.js';
import http from 'node:http';

describe('Chat Routes', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    server = app.listen(0);
    const addr = server.address() as { port: number };
    baseUrl = `http://localhost:${addr.port}`;
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('Authentication Guard', () => {
    it('GET /v1/chats should require authentication', async () => {
      const res = await fetch(`${baseUrl}/v1/chats`);
      expect(res.status).toBe(401);
    });

    it('POST /v1/chats/direct should require authentication', async () => {
      const res = await fetch(`${baseUrl}/v1/chats/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientUserId: '00000000-0000-0000-0000-000000000001' }),
      });
      expect(res.status).toBe(401);
    });

    it('POST /v1/chats/group should require authentication', async () => {
      const res = await fetch(`${baseUrl}/v1/chats/group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Group',
          memberUserIds: ['00000000-0000-0000-0000-000000000001'],
        }),
      });
      expect(res.status).toBe(401);
    });

    it('PATCH /v1/chats/:chatId should require authentication', async () => {
      const res = await fetch(`${baseUrl}/v1/chats/00000000-0000-0000-0000-000000000001`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      });
      expect(res.status).toBe(401);
    });

    it('DELETE /v1/chats/:chatId should require authentication', async () => {
      const res = await fetch(`${baseUrl}/v1/chats/00000000-0000-0000-0000-000000000001`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(401);
    });

    it('POST /v1/chats/:chatId/read should require authentication', async () => {
      const res = await fetch(`${baseUrl}/v1/chats/00000000-0000-0000-0000-000000000001/read`, {
        method: 'POST',
      });
      expect(res.status).toBe(401);
    });
  });

  describe('Invalid Token', () => {
    it('should reject expired/invalid Bearer tokens', async () => {
      const res = await fetch(`${baseUrl}/v1/chats`, {
        headers: { Authorization: 'Bearer invalid.token.here' },
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it('should reject non-Bearer auth headers', async () => {
      const res = await fetch(`${baseUrl}/v1/chats`, {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      });
      expect(res.status).toBe(401);
    });
  });
});
