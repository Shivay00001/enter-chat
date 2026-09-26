-- EnterChat Migration 020: Chat profile columns
-- The chats table (007) has no title/description/avatar, but the product needs
-- them for group/channel chats (creation API, chat lists, WS broadcasts).
-- Per docs/schema-trd.md, migrations are the source of truth, so the columns
-- are added here rather than inventing a parallel schema in code.

ALTER TABLE chats ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS avatar_media_id UUID;

COMMENT ON COLUMN chats.title IS 'Display title for group/channel/community chats. NULL for direct chats (derived from the peer).';
