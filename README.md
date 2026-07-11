# EnterChat

Decentralized, secure, scalable communication platform.

## Architecture

```
enterchat/
  apps/mobile_flutter/     # Flutter mobile app (Riverpod + GoRouter)
  services/api_gateway/    # Node.js/TypeScript API + WebSocket gateway
  infra/
    docker/                # Dockerfiles
    migrations/            # PostgreSQL SQL migrations
  packages/
    proto/                 # gRPC proto definitions (future)
    config/                # Shared config schemas
```

**Frontend**: Flutter, Clean Architecture, feature-first, Riverpod, GoRouter, Hive/SQLite-ready.
**Backend**: Node.js/TypeScript, hexagonal architecture, Express REST + ws WebSocket.
**Database**: PostgreSQL 16 (partitioned messages), Redis 7 (cache/presence/rate-limits).
**Infra**: Docker Compose for local dev, CI-ready with GitHub Actions.

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- Flutter SDK 3.x

### 1. Start infrastructure
```bash
cp .env.example .env
# Edit .env with your values (defaults work for local dev)
docker compose up -d postgres redis
```

### 2. Run database migrations
```bash
# Migrations run automatically on postgres container start via init scripts
# Or manually:
docker compose exec postgres psql -U enterchat -d enterchat -f /docker-entrypoint-initdb.d/001_extensions.sql
```

### 3. Start backend
```bash
cd services/api_gateway
npm install
npm run dev
```

API: http://localhost:3000
WebSocket: ws://localhost:3001
Health: http://localhost:3000/health

### 4. Start Flutter app
```bash
cd apps/mobile_flutter
flutter pub get
flutter run
```

### Or run everything with Docker Compose
```bash
docker compose up
```

## API Overview

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Liveness check |
| `/ready` | GET | Readiness check (DB + Redis) |
| `/v1/auth/otp/start` | POST | Start OTP flow |
| `/v1/auth/otp/verify` | POST | Verify OTP, get tokens |
| `/v1/auth/token/refresh` | POST | Refresh access token |
| `/v1/auth/logout` | POST | Revoke session |
| `/v1/users/me` | GET | Get current user |
| `/v1/users/me/profile` | PATCH | Update profile |
| `/v1/chats` | GET | List chats (cursor) |
| `/v1/chats/direct` | POST | Create direct chat |
| `/v1/chats/group` | POST | Create group chat |
| `/v1/chats/:id` | PATCH | Update chat details |
| `/v1/chats/:id` | DELETE | Delete chat |
| `/v1/chats/:id/messages` | GET | Get messages (cursor) |
| `/v1/chats/:id/messages` | POST | Send message |
| `/v1/chats/:id/read` | POST | Mark chat as read |
| `/v1/messages/:id` | PATCH | Edit message |
| `/v1/messages/:id` | DELETE | Delete message |
| `/v1/messages/:id/reactions` | POST | React to message |
| `/v1/media/upload` | POST | Upload media file |
| `/v1/media/uploads` | POST | Create chunked upload |
| `/v1/media/:id` | GET | Get media metadata |
| `/v1/media/:id` | DELETE | Delete media |
| `/v1/stories` | GET | Get story feed |
| `/v1/stories` | POST | Create story |
| `/v1/notifications/register-token` | POST | Register push token |
| `/v1/notifications/token` | DELETE | Unregister push token |
| `/v1/notifications/settings` | GET | Get notification prefs |
| `/v1/notifications/settings` | PATCH | Update notification prefs |

## Environment Variables

See [.env.example](.env.example) for all configuration options.

**Security rules:**
- No hardcoded secrets, API keys, tokens, or credentials anywhere in code.
- All limits (rate limits, message size, token TTL) are configurable via env.
- Secrets in logs are masked — OTPs, tokens, private keys are never logged.

## Project Decisions (ADRs)

| ADR | Decision | Rationale |
|---|---|---|
| ADR-001 | Flutter for clients | Cross-platform, shared design system |
| ADR-002 | PostgreSQL first | Relational integrity, partitioning-ready |
| ADR-003 | NATS JetStream for events (future) | Lower ops cost than Kafka for MVP |
| ADR-004 | REST public + gRPC internal | Best fit per client type |
| ADR-005 | Node.js/TS for MVP backend | Faster iteration, hexagonal ports allow Go migration |

## License

Proprietary — EnterChat. All rights reserved.
