-- EnterChat Migration 004: Devices table

CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  platform device_platform NOT NULL,
  device_public_key BYTEA,
  identity_key BYTEA,
  signed_prekey BYTEA,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  trusted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_user_id ON devices (user_id, revoked_at);
