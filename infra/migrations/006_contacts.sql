-- EnterChat Migration 006: Contacts table

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  external_identifier_hash BYTEA,
  display_alias TEXT,
  source contact_source NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_user_id, contact_user_id)
);

CREATE INDEX idx_contacts_owner ON contacts (owner_user_id);
CREATE INDEX idx_contacts_contact ON contacts (contact_user_id) WHERE contact_user_id IS NOT NULL;
