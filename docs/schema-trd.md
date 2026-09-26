# TRD — Schema Drift: which side is source of truth?

Date: 2026-09-26 | Author: Nerc (fix/schema-drift-2026-09-26)
Status: **DECIDED — migrations are the source of truth**

## Problem

The Postgres repository code in `services/api_gateway/` was written against a
different (simpler, naive) schema than `infra/migrations/` actually creates.
The two were evidently never run against each other: unit tests mock `pg`
entirely, so the drift survived a 57/57 test pass. Against a real PostgreSQL 16
the core journeys fail: OTP verify → 500 (`devices.created_at` missing),
chat creation → 500 (`chats.chat_type`, `chat_members.member_state`/`id`
missing), and 6 of 19 migrations don't apply at all.

## Decision

**`infra/migrations/*.sql` defines the deployed schema. All application SQL is
aligned to it, and the broken migrations are repaired in place.**

Rationale:

1. The migrations are the only schema definition that has ever touched a real
   database. The repo code's imagined schema exists nowhere — no DDL for it
   was ever written, let alone deployed.
2. Migrations 001–014 are a coherent, well-designed schema (proper enums,
   partitioned `messages`, E2EE key material, FK discipline). The adapter code
   assumes a flat toy schema (`messages.content`, `messages.msg_type`,
   `chat_members.id`) that would be a downgrade to adopt.
3. Migrations are append-only and ordered; repairing the broken ones (006, 008,
   015–018) keeps a single linear history that applies cleanly on a fresh DB.

## Consequences / mapping rules (applied consistently)

| App code assumed | Migration reality | Fix |
|---|---|---|
| `devices.created_at` | missing in 004 | **Repaired 004**: added `created_at` (every other table has one; sane) |
| `chats.chat_type`, `title`, `description`, `avatar_media_id`, `state`, `updated_at` | 007 has `type`, `visibility`, `e2ee_mode`, `home_region`, `created_by`, `created_at`, `archived_at` | Code now uses `type` (cast to `chat_type`; `community`→`community_room`); "active" filter = `archived_at IS NULL`; delete = set `archived_at` |
| group-chat `title`/`description`/`avatar` | missing in 007 | **New migration 020** adds `title`, `description`, `avatar_media_id` to `chats` — a chat product without group titles is not sane; extension, not drift |
| `chat_members.id`, `member_state`, `left_at` | 007 has composite PK `(chat_id, user_id)` and `state` (`member_state` enum: active/muted/left/banned/pending) | Code uses `state`; leave/remove → `state='left'` (`removed` is not a valid enum value) |
| `messages.sender_id`, `content`, `msg_type`, `updated_at` | 008 has `sender_user_id`, `plaintext_body`/`ciphertext`, `message_type` enum, `state`, no `updated_at` | Code maps `content`→`plaintext_body`, `msgType`→`message_type` (`voice_note`→`voice`, `file`→`document`); edit sets `state='edited'`; delete-for-everyone sets `state='deleted'` + `deleted_at` |
| 006 `PRIMARY KEY (owner, COALESCE(...))` | invalid PG (expressions not allowed in PK) | Surrogate `id` PK + `UNIQUE(owner_user_id, contact_user_id)` |
| 008 unique index on partitioned table | must include partition key | `(sender_user_id, idempotency_key, created_at)`; true idempotency stays an app-layer concern |
| 015 `WHERE expires_at > NOW()` index predicate | non-immutable predicate rejected | Plain index, no predicate |
| 015/018 `REFERENCES messages(id)` | invalid — partitioned PK is `(id, created_at)` | FK dropped, column kept + comment (reactions/deletions/p2p system messages) |
| 016 index on `media_objects(uploader_user_id, …)` | column doesn't exist; 009 uses `owner_user_id` | Index on `(owner_user_id, created_at DESC)` |
| 017 index on `messages(chat_id, sender_id)` | column is `sender_user_id` | Fixed |
| Stories affinity query (`m.sender_id`, `u.avatar_url`) | columns are `sender_user_id`, `avatar_media_id` | Fixed in `stories/adapters/postgres.ts` |
| Transfers system messages (`sender_id`, `content`, `msg_type`) | same messages drift | Fixed to migration columns, `message_type='system'` |

## Non-goals

- No data migration: there is no production data; fresh-DB apply is the target.
- API shape is preserved where possible (same repo method signatures, same
  route contracts); only SQL internals changed.
- E2EE `ciphertext` path is untouched — plaintext path writes `plaintext_body`
  (dev/test + non-E2EE chats); the E2EE flow can adopt `ciphertext` later.

## Verification

All 19+1 migrations apply zero-error on a fresh PostgreSQL 16 DB; the
end-to-end sequence (OTP verify → tokens, create direct chat, send/list
messages, WS ping/pong) passes against the real DB; `npm test` stays 57/57.
