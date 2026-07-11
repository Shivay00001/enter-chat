-- EnterChat Migration 003: Users table

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  home_region TEXT NOT NULL DEFAULT 'default',
  home_server_id UUID,
  phone_hash BYTEA UNIQUE,
  email_hash BYTEA UNIQUE,
  username CITEXT UNIQUE,
  display_name TEXT NOT NULL,
  avatar_media_id UUID,
  status_text TEXT,
  locale TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  account_state account_state NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_account_state ON users (account_state);
CREATE UNIQUE INDEX idx_users_phone_hash ON users (phone_hash) WHERE phone_hash IS NOT NULL;
CREATE UNIQUE INDEX idx_users_email_hash ON users (email_hash) WHERE email_hash IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
