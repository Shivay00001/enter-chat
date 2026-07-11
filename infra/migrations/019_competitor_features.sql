-- EnterChat Migration 019: Competitor-Inspired Feature Gaps
-- Adds: Disappearing messages, blocked users, polls, online presence, link previews
-- Features inspired by WhatsApp, Telegram, Signal, Discord

-- ============================================================
-- 1. BLOCKED USERS (WhatsApp/Telegram/Signal)
-- ============================================================

CREATE TABLE IF NOT EXISTS blocked_users (
    blocker_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason          VARCHAR(50),   -- 'spam', 'harassment', 'other'
    blocked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users (blocked_id);

COMMENT ON TABLE blocked_users IS 'Block list. Blocked users cannot send messages, see stories, or view online status.';

-- ============================================================
-- 2. DISAPPEARING MESSAGES (WhatsApp/Telegram/Signal)
-- ============================================================

-- Add disappearing message settings to chats
ALTER TABLE chats ADD COLUMN IF NOT EXISTS disappearing_timer_seconds INT;
-- NULL = off, values: 86400 (24h), 604800 (7d), 7776000 (90d)

-- Per-user default disappearing timer
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_disappearing_timer INT;

COMMENT ON COLUMN chats.disappearing_timer_seconds IS 'Auto-delete timer for new messages. NULL=off. WhatsApp-style.';

-- ============================================================
-- 3. POLLS (WhatsApp/Telegram)
-- ============================================================

CREATE TABLE IF NOT EXISTS polls (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id         UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    message_id      UUID NOT NULL,   -- FK to the message containing the poll
    creator_id      UUID NOT NULL REFERENCES users(id),
    question        TEXT NOT NULL,
    poll_type       VARCHAR(20) NOT NULL DEFAULT 'single', -- 'single', 'multiple'
    is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,
    is_closed       BOOLEAN NOT NULL DEFAULT FALSE,
    closes_at       TIMESTAMPTZ,     -- Auto-close timer
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poll_options (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id         UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_text     TEXT NOT NULL,
    sort_order      INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS poll_votes (
    poll_id         UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id       UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    voted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (poll_id, user_id, option_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes (poll_id);

COMMENT ON TABLE polls IS 'In-chat polls like WhatsApp/Telegram. Supports single/multiple choice, anonymous voting.';

-- ============================================================
-- 4. USER PRESENCE / ONLINE STATUS (WhatsApp/Telegram/Discord)
-- ============================================================

-- Track last_seen and online status
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_last_seen BOOLEAN NOT NULL DEFAULT TRUE;
-- Privacy: show_last_seen controls who sees your last_seen timestamp

CREATE INDEX IF NOT EXISTS idx_users_online ON users (is_online) WHERE is_online = TRUE;

-- ============================================================
-- 5. LINK PREVIEWS CACHE (WhatsApp/Telegram/Discord)
-- ============================================================

CREATE TABLE IF NOT EXISTS link_previews (
    url_hash        VARCHAR(64) PRIMARY KEY,  -- SHA-256 of normalized URL
    url             TEXT NOT NULL,
    title           TEXT,
    description     TEXT,
    image_url       TEXT,
    site_name       TEXT,
    favicon_url     TEXT,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_link_previews_expires ON link_previews (expires_at);

COMMENT ON TABLE link_previews IS 'Cached Open Graph metadata for URLs shared in messages. 7-day TTL.';

-- ============================================================
-- 6. MESSAGE PINS (Telegram/Discord)
-- ============================================================

CREATE TABLE IF NOT EXISTS pinned_messages (
    chat_id         UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    message_id      UUID NOT NULL,
    pinned_by       UUID NOT NULL REFERENCES users(id),
    pinned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (chat_id, message_id)
);

COMMENT ON TABLE pinned_messages IS 'Pinned messages per chat. Telegram/Discord-style.';

-- ============================================================
-- 7. CHAT FOLDERS / LABELS (Telegram)
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_folders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    icon            VARCHAR(20),   -- emoji or icon name
    sort_order      INT NOT NULL DEFAULT 0,
    filter_unread   BOOLEAN NOT NULL DEFAULT FALSE,
    filter_muted    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_folder_items (
    folder_id       UUID NOT NULL REFERENCES chat_folders(id) ON DELETE CASCADE,
    chat_id         UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    PRIMARY KEY (folder_id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_folders_user ON chat_folders (user_id, sort_order);

COMMENT ON TABLE chat_folders IS 'Custom chat folders for organizing conversations. Telegram-style.';

-- ============================================================
-- 8. SCHEDULED MESSAGES (Telegram)
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduled_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id         UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id),
    content         TEXT NOT NULL,
    message_type    message_type NOT NULL DEFAULT 'text',
    media_url       TEXT,
    scheduled_for   TIMESTAMPTZ NOT NULL,
    sent_at         TIMESTAMPTZ,    -- NULL until sent
    cancelled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_pending
    ON scheduled_messages (scheduled_for)
    WHERE sent_at IS NULL AND cancelled_at IS NULL;

COMMENT ON TABLE scheduled_messages IS 'Schedule messages for future delivery. Telegram-style.';
