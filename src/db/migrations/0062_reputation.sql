-- Reputation system: scopes (career paths) and standings (tiers)
-- Depends on: factions (0058)

CREATE TABLE reputation_scopes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  scope_key         TEXT    NOT NULL,
  description       TEXT,
  faction_id        INTEGER REFERENCES factions(id),
  max_reputation    INTEGER,
  initial_reputation INTEGER DEFAULT 0,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);
CREATE INDEX idx_reputation_scopes_key ON reputation_scopes(scope_key);

CREATE TABLE reputation_standings (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  scope_id          INTEGER NOT NULL REFERENCES reputation_scopes(id),
  min_reputation    INTEGER NOT NULL,
  drift_reputation  INTEGER DEFAULT 0,
  drift_time_hours  REAL    DEFAULT 0,
  is_gated          INTEGER DEFAULT 0,
  perk_description  TEXT,
  sort_order        INTEGER,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);
CREATE INDEX idx_reputation_standings_scope ON reputation_standings(scope_id);
