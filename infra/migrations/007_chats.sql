-- EnterChat Migration 007: Chats and Chat Members

CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type chat_type NOT NULL,
  visibility chat_visibility NOT NULL DEFAULT 'private',
  e2ee_mode e2ee_mode NOT NULL DEFAULT 'optional',
  home_region TEXT NOT NULL DEFAULT 'default',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX idx_chats_type_created ON chats (type, created_at);
CREATE INDEX idx_chats_region ON chats (home_region, id);

CREATE TABLE chat_members (
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  state member_state NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_message_id UUID,
  notification_level notification_level NOT NULL DEFAULT 'all',
  PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX idx_chat_members_user ON chat_members (user_id, state);
CREATE INDEX idx_chat_members_role ON chat_members (chat_id, role);
