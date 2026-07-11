-- EnterChat Migration 011: Calls

CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiator_user_id UUID NOT NULL REFERENCES users(id),
  chat_id UUID REFERENCES chats(id),
  type call_type NOT NULL,
  state call_state NOT NULL DEFAULT 'ringing',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE INDEX idx_calls_initiator ON calls (initiator_user_id, started_at DESC);
CREATE INDEX idx_calls_chat ON calls (chat_id, started_at DESC) WHERE chat_id IS NOT NULL;
CREATE INDEX idx_calls_state ON calls (state) WHERE state IN ('ringing', 'active');
