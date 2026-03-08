-- Factions: 55 game factions with reputation and law enforcement data
-- No FK dependencies on other new tables

CREATE TABLE factions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  description       TEXT,
  faction_type      TEXT,
  headquarters      TEXT,
  founded           TEXT,
  leadership        TEXT,
  area              TEXT,
  focus             TEXT,
  default_reaction  TEXT,
  can_arrest        INTEGER DEFAULT 0,
  polices_crime     INTEGER DEFAULT 0,
  no_legal_rights   INTEGER DEFAULT 0,
  allies_json       TEXT,
  enemies_json      TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);
CREATE INDEX idx_factions_type ON factions(faction_type);
CREATE INDEX idx_factions_slug ON factions(slug);
