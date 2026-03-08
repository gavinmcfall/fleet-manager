-- Junction table: factions <-> reputation_scopes (many-to-many)
-- A faction can have multiple reputation scopes (e.g., Citizens For Prosperity has Security, Courier, Salvage)
-- A scope can belong to multiple factions (e.g., Affinity is primary for 21+ factions)
--
-- is_primary: 1 if this is the faction's primary scope (from context.primaryScopeContext)
-- source: how the link was determined ('context_primary', 'context_list')

CREATE TABLE IF NOT EXISTS faction_reputation_scopes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  faction_id        INTEGER NOT NULL REFERENCES factions(id),
  reputation_scope_id INTEGER NOT NULL REFERENCES reputation_scopes(id),
  is_primary        INTEGER DEFAULT 0,
  source            TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  UNIQUE(faction_id, reputation_scope_id, game_version_id)
);

CREATE INDEX IF NOT EXISTS idx_faction_reputation_scopes_faction ON faction_reputation_scopes(faction_id);
CREATE INDEX IF NOT EXISTS idx_faction_reputation_scopes_scope ON faction_reputation_scopes(reputation_scope_id);
CREATE INDEX IF NOT EXISTS idx_faction_reputation_scopes_version ON faction_reputation_scopes(game_version_id);
