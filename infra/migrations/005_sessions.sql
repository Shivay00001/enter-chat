-- EnterChat Migration 005: Sessions table

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  refresh_token_hash BYTEA NOT NULL,
  ip_hash BYTEA,
  user_agent_hash BYTEA,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  rotation_counter BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_sessions_user_device ON sessions (user_id, device_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);
CREATE INDEX idx_sessions_refresh_token ON sessions (refresh_token_hash) WHERE revoked_at IS NULL;
