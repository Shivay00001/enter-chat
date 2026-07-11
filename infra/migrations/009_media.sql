-- EnterChat Migration 009: Media

CREATE TABLE media_objects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  storage_provider TEXT NOT NULL DEFAULT 'local',
  bucket TEXT NOT NULL DEFAULT 'enterchat-media',
  object_key TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  sha256 BYTEA,
  encryption_mode media_encryption_mode NOT NULL DEFAULT 'server',
  encryption_metadata JSONB,
  processing_state media_processing_state NOT NULL DEFAULT 'uploading',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_owner ON media_objects (owner_user_id, created_at);
CREATE INDEX idx_media_sha256 ON media_objects (sha256) WHERE sha256 IS NOT NULL;
CREATE INDEX idx_media_processing ON media_objects (processing_state);

CREATE TABLE message_media (
  message_id UUID NOT NULL,
  media_id UUID NOT NULL REFERENCES media_objects(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (message_id, media_id)
);
