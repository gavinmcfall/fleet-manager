-- Org system rework: verify-then-create flow + join codes + multi-org support
--
-- Before: orgs created freely via Better Auth, then verified after the fact.
-- After: verification happens BEFORE org creation. RSI SID → charter key → verify → org auto-created.
-- Join codes let members join without email invitations.

-- Pending verification for verify-then-create flow
CREATE TABLE org_verification_pending (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  rsi_sid TEXT NOT NULL,
  verification_key TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(rsi_sid)
);
CREATE INDEX idx_org_verification_pending_user ON org_verification_pending(user_id);

-- Join codes for org membership
CREATE TABLE org_join_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  max_uses INTEGER,
  use_count INTEGER DEFAULT 0,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_org_join_codes_org ON org_join_codes(organization_id);
CREATE INDEX idx_org_join_codes_code ON org_join_codes(code);

-- RSI-scraped org data columns on organization table
ALTER TABLE organization ADD COLUMN rsi_model TEXT;
ALTER TABLE organization ADD COLUMN rsi_commitment TEXT;
ALTER TABLE organization ADD COLUMN rsi_roleplay TEXT;
ALTER TABLE organization ADD COLUMN rsi_primary_focus TEXT;
ALTER TABLE organization ADD COLUMN rsi_secondary_focus TEXT;
ALTER TABLE organization ADD COLUMN rsi_banner_url TEXT;
ALTER TABLE organization ADD COLUMN rsi_member_count INTEGER;
ALTER TABLE organization ADD COLUMN rsi_history_html TEXT;
ALTER TABLE organization ADD COLUMN rsi_manifesto_html TEXT;
ALTER TABLE organization ADD COLUMN rsi_charter_html TEXT;
ALTER TABLE organization ADD COLUMN last_synced_at TEXT;

-- Primary org preference per user
ALTER TABLE user ADD COLUMN primary_org_id TEXT;
