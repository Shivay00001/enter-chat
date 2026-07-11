-- EnterChat Migration 008: Messages (partitioned) and Reactions

-- Messages partitioned by month for scalability
CREATE TABLE messages (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL,
  sender_user_id UUID,
  sender_device_id UUID,
  message_type message_type NOT NULL,
  ciphertext BYTEA,
  plaintext_body TEXT,
  metadata JSONB,
  reply_to_message_id UUID,
  thread_root_id UUID,
  version INTEGER NOT NULL DEFAULT 1,
  state message_state NOT NULL DEFAULT 'active',
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for the next 12 months
-- In production, use pg_partman or a cron job to create future partitions
CREATE TABLE messages_2026_06 PARTITION OF messages
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE messages_2026_07 PARTITION OF messages
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE messages_2026_08 PARTITION OF messages
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE messages_2026_09 PARTITION OF messages
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE messages_2026_10 PARTITION OF messages
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE messages_2026_11 PARTITION OF messages
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE messages_2026_12 PARTITION OF messages
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE messages_2027_01 PARTITION OF messages
  FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE messages_2027_02 PARTITION OF messages
  FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE messages_2027_03 PARTITION OF messages
  FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');
CREATE TABLE messages_2027_04 PARTITION OF messages
  FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');
CREATE TABLE messages_2027_05 PARTITION OF messages
  FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');

-- Default partition for anything outside the range
CREATE TABLE messages_default PARTITION OF messages DEFAULT;

CREATE INDEX idx_messages_chat_created ON messages (chat_id, created_at DESC);
CREATE INDEX idx_messages_sender_created ON messages (sender_user_id, created_at DESC);
CREATE UNIQUE INDEX idx_messages_idempotency ON messages (sender_user_id, idempotency_key);
CREATE INDEX idx_messages_thread ON messages (thread_root_id, created_at) WHERE thread_root_id IS NOT NULL;

-- Reactions
CREATE TABLE reactions (
  message_id UUID NOT NULL,
  message_created_at TIMESTAMPTZ NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX idx_reactions_message ON reactions (message_id, message_created_at);
