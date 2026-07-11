import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/server.js';
import http from 'node:http';

describe('Message Routes', () => {
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

  const chatId = '00000000-0000-0000-0000-000000000001';
  const messageId = '00000000-0000-0000-0000-000000000002';

  describe('Authentication Guard', () => {
    it('POST /v1/chats/:chatId/messages should require auth', async () => {
      const res = await fetch(`${baseUrl}/v1/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientMessageId: '00000000-0000-0000-0000-000000000099',
          msgType: 'text',
          content: 'Hello, World!',
        }),
      });
      expect(res.status).toBe(401);
    });

    it('GET /v1/chats/:chatId/messages should require auth', async () => {
      const res = await fetch(`${baseUrl}/v1/chats/${chatId}/messages`);
      expect(res.status).toBe(401);
    });

    it('GET /v1/chats/:chatId/messages/search should require auth', async () => {
      const res = await fetch(`${baseUrl}/v1/chats/${chatId}/messages/search?q=hello`);
      expect(res.status).toBe(401);
    });

    it('PATCH /v1/messages/:messageId should require auth', async () => {
      const res = await fetch(`${baseUrl}/v1/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Edited' }),
      });
      expect(res.status).toBe(401);
    });

    it('DELETE /v1/messages/:messageId should require auth', async () => {
      const res = await fetch(`${baseUrl}/v1/messages/${messageId}`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(401);
    });

    it('POST /v1/messages/:messageId/reactions should require auth', async () => {
      const res = await fetch(`${baseUrl}/v1/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji: '👍' }),
      });
      expect(res.status).toBe(401);
    });
  });
});

describe('Media Routes', () => {
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
    it('POST /v1/media/upload should require auth', async () => {
      const res = await fetch(`${baseUrl}/v1/media/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'test.jpg',
          mimeType: 'image/jpeg',
          data: 'dGVzdA==',
        }),
      });
      expect(res.status).toBe(401);
    });

    it('POST /v1/media/uploads should require auth', async () => {
      const res = await fetch(`${baseUrl}/v1/media/uploads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'test.mp4',
          sizeBytes: 1024,
          mimeType: 'video/mp4',
        }),
      });
      expect(res.status).toBe(401);
    });

    it('GET /v1/media/:mediaId should require auth', async () => {
      const res = await fetch(`${baseUrl}/v1/media/00000000-0000-0000-0000-000000000001`);
      expect(res.status).toBe(401);
    });
  });
});

describe('Notification Routes', () => {
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
    it('POST /v1/notifications/register-token should require auth', async () => {
      const res = await fetch(`${baseUrl}/v1/notifications/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'fcm-token-xyz', platform: 'android' }),
      });
      expect(res.status).toBe(401);
    });

    it('DELETE /v1/notifications/token should require auth', async () => {
      const res = await fetch(`${baseUrl}/v1/notifications/token`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(401);
    });

    it('GET /v1/notifications/settings should require auth', async () => {
      const res = await fetch(`${baseUrl}/v1/notifications/settings`);
      expect(res.status).toBe(401);
    });

    it('PATCH /v1/notifications/settings should require auth', async () => {
      const res = await fetch(`${baseUrl}/v1/notifications/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pushEnabled: false }),
      });
      expect(res.status).toBe(401);
    });
  });
});

describe('Stories Routes', () => {
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
    it('GET /v1/stories should require auth', async () => {
      const res = await fetch(`${baseUrl}/v1/stories`);
      expect(res.status).toBe(401);
    });

    it('POST /v1/stories should require auth', async () => {
      const res = await fetch(`${baseUrl}/v1/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaUrl: 'https://example.com/photo.jpg',
          mediaType: 'image',
        }),
      });
      expect(res.status).toBe(401);
    });
  });
});
