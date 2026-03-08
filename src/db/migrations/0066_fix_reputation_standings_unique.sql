-- Fix reputation_standings UNIQUE constraint: standings can be shared across scopes,
-- so the constraint must include scope_id.

CREATE TABLE reputation_standings_new (
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
  UNIQUE(uuid, scope_id, game_version_id)
);

INSERT INTO reputation_standings_new
  SELECT * FROM reputation_standings;

DROP TABLE reputation_standings;
ALTER TABLE reputation_standings_new RENAME TO reputation_standings;

CREATE INDEX idx_reputation_standings_scope ON reputation_standings(scope_id);
