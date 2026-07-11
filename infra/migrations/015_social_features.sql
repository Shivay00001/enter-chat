-- 015_stories.sql
-- Instagram/WhatsApp/Snapchat-like ephemeral stories (24h).

CREATE TABLE IF NOT EXISTS stories (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_url           TEXT NOT NULL,
    media_type          VARCHAR(10) NOT NULL CHECK (media_type IN ('image', 'video')),
    caption             TEXT,
    background_color    VARCHAR(7),
    duration_seconds    INT,
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories (user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories (expires_at) WHERE expires_at > NOW();

-- Story views (who has seen the story)
CREATE TABLE IF NOT EXISTS story_views (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id    UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    viewer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(story_id, viewer_id)
);

-- Story reactions
CREATE TABLE IF NOT EXISTS story_reactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id    UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji       VARCHAR(8) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(story_id, user_id)
);

-- Message reactions
CREATE TABLE IF NOT EXISTS message_reactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji       VARCHAR(8) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions (message_id);

-- Message soft deletions (per-user: "delete for me")
CREATE TABLE IF NOT EXISTS message_deletions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deleted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Add columns to messages table if not exist
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_metadata JSONB;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS forward_from_message_id UUID REFERENCES messages(id);

-- Add last_read_at to chat_members if not exist
ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

-- Cleanup expired stories (run via pg_cron or scheduled job)
-- DELETE FROM stories WHERE expires_at < NOW() - INTERVAL '48 hours';

COMMENT ON TABLE stories IS 'Ephemeral stories visible for 24 hours, like Instagram/WhatsApp stories';
COMMENT ON TABLE message_reactions IS 'Emoji reactions on messages, like Telegram/iMessage';
COMMENT ON TABLE message_deletions IS 'Per-user message deletions (delete for me only)';
