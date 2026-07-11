-- EnterChat Migration 002: Enum types
-- All enum types used across the schema.

CREATE TYPE account_state AS ENUM ('active', 'restricted', 'suspended', 'deleting', 'deleted');
CREATE TYPE device_platform AS ENUM ('android', 'ios', 'web', 'desktop');
CREATE TYPE contact_source AS ENUM ('phonebook', 'username', 'qr', 'bridge', 'manual');
CREATE TYPE chat_type AS ENUM ('direct', 'group', 'channel', 'community_room', 'bridge');
CREATE TYPE chat_visibility AS ENUM ('private', 'invite', 'public');
CREATE TYPE e2ee_mode AS ENUM ('required', 'optional', 'unavailable', 'bridge_dependent');
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'moderator', 'member', 'guest');
CREATE TYPE member_state AS ENUM ('active', 'muted', 'left', 'banned', 'pending');
CREATE TYPE notification_level AS ENUM ('all', 'mentions', 'muted');
CREATE TYPE message_type AS ENUM ('text', 'image', 'video', 'audio', 'voice', 'document', 'contact', 'location', 'poll', 'sticker', 'gif', 'system');
CREATE TYPE message_state AS ENUM ('active', 'edited', 'deleted', 'tombstoned');
CREATE TYPE media_encryption_mode AS ENUM ('server', 'client_e2ee');
CREATE TYPE media_processing_state AS ENUM ('uploading', 'uploaded', 'scanning', 'transcoding', 'ready', 'failed', 'blocked');
CREATE TYPE invite_policy AS ENUM ('open_link', 'approval', 'admin_only');
CREATE TYPE channel_visibility AS ENUM ('private', 'public');
CREATE TYPE call_type AS ENUM ('audio', 'video', 'group');
CREATE TYPE call_state AS ENUM ('ringing', 'active', 'ended', 'missed', 'failed');
CREATE TYPE notification_delivery_state AS ENUM ('pending', 'sent', 'failed', 'suppressed');
