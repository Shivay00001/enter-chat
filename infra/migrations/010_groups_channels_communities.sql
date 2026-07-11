-- EnterChat Migration 010: Groups, Channels, Communities

CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL UNIQUE REFERENCES chats(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  avatar_media_id UUID REFERENCES media_objects(id),
  max_members INTEGER NOT NULL DEFAULT 1024,
  invite_policy invite_policy NOT NULL DEFAULT 'admin_only',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL UNIQUE REFERENCES chats(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  handle CITEXT UNIQUE,
  description TEXT,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  comments_chat_id UUID REFERENCES chats(id),
  visibility channel_visibility NOT NULL DEFAULT 'private',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE communities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  handle CITEXT UNIQUE,
  description TEXT,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  visibility channel_visibility NOT NULL DEFAULT 'private',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE community_members (
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (community_id, user_id)
);

CREATE TABLE community_spaces (
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (community_id, chat_id)
);
