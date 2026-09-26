-- EnterChat Migration 017: Delivery receipts + E2EE key bundles
-- Adds delivery tracking to messages and E2EE key exchange infrastructure.

-- 1. Message delivery tracking
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_delivery
  ON messages (chat_id, sender_user_id) WHERE delivered_at IS NULL;

-- 2. E2EE Key Bundles — X3DH protocol support
-- Each device uploads a key bundle containing identity key, signed prekey, and one-time prekeys.

CREATE TABLE IF NOT EXISTS key_bundles (
    device_id       UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    identity_key    TEXT NOT NULL,          -- Base64-encoded public identity key
    signed_prekey   TEXT NOT NULL,          -- Base64-encoded signed prekey
    signed_prekey_signature TEXT NOT NULL,  -- Signature of the signed prekey
    prekey_id       INT NOT NULL DEFAULT 0, -- Current signed prekey rotation ID
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_key_bundles_user ON key_bundles (user_id);

-- 3. One-Time Prekeys (OPK) — consumed on first message to a device
CREATE TABLE IF NOT EXISTS one_time_prekeys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id          INT NOT NULL,           -- OPK index
    public_key      TEXT NOT NULL,          -- Base64-encoded one-time prekey
    consumed_at     TIMESTAMPTZ,           -- NULL = available, set = used
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(device_id, key_id)
);

CREATE INDEX IF NOT EXISTS idx_otpk_available
  ON one_time_prekeys (device_id, user_id) WHERE consumed_at IS NULL;

COMMENT ON TABLE key_bundles IS 'X3DH key bundles for end-to-end encryption. Each device has one active bundle.';
COMMENT ON TABLE one_time_prekeys IS 'One-time prekeys consumed during initial key exchange to provide forward secrecy.';
