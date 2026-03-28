-- Overlay packs: admin-curated sets of global.ini overrides (e.g., blueprint pools, contraband warnings)
-- Pack content stored in KV; this table holds metadata for listing + ordering.

CREATE TABLE localization_overlay_packs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL UNIQUE,
  label        TEXT    NOT NULL,
  description  TEXT,
  icon         TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1,
  version_code TEXT,
  key_count    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    DEFAULT (datetime('now')),
  updated_at   TEXT    DEFAULT (datetime('now'))
);

-- User's enabled packs (JSON array of pack name strings)
ALTER TABLE user_localization_configs ADD COLUMN enabled_packs_json TEXT;
