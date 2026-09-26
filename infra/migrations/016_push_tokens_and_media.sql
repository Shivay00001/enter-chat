-- EnterChat Migration 016: Push tokens, notification preferences, media enhancements
-- Adds push notification support to devices, user notification preferences,
-- and ensures media_objects table has the columns needed by the media pipeline.

-- 1. Add push token columns to devices table
ALTER TABLE devices ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS push_platform VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_devices_push_token
  ON devices (user_id) WHERE push_token IS NOT NULL AND revoked_at IS NULL;

-- 2. Notification preferences per user
CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    push_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    sound_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    vibrate_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    preview_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notification_preferences IS 'Per-user notification settings (push, sound, vibrate, preview)';

-- 3. Ensure media_objects table has all required columns
-- Add chat_id column if not exists (for associating media with chats)
ALTER TABLE media_objects ADD COLUMN IF NOT EXISTS chat_id UUID REFERENCES chats(id) ON DELETE SET NULL;
ALTER TABLE media_objects ADD COLUMN IF NOT EXISTS original_name TEXT;
ALTER TABLE media_objects ADD COLUMN IF NOT EXISTS storage_key TEXT;

CREATE INDEX IF NOT EXISTS idx_media_objects_uploader
  ON media_objects (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_objects_chat
  ON media_objects (chat_id) WHERE chat_id IS NOT NULL;
