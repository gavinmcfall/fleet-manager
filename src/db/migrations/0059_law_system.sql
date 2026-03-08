-- Law system: jurisdictions, infractions, and per-jurisdiction overrides
-- No FK dependencies on other new tables

CREATE TABLE law_jurisdictions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                  TEXT    NOT NULL,
  name                  TEXT    NOT NULL,
  slug                  TEXT,
  parent_uuid           TEXT,
  respects_parent_laws  INTEGER DEFAULT 1,
  base_fine             INTEGER,
  is_prison             INTEGER DEFAULT 0,
  max_stolen_goods_scu  REAL,
  prohibited_goods_json TEXT,
  controlled_substances_json TEXT,
  game_version_id       INTEGER NOT NULL REFERENCES game_versions(id),
  created_at            TEXT    DEFAULT (datetime('now')),
  updated_at            TEXT    DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);
CREATE INDEX idx_law_jurisdictions_slug ON law_jurisdictions(slug);

CREATE TABLE law_infractions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  description       TEXT,
  severity          TEXT    NOT NULL,
  triggers_json     TEXT,
  stats_json        TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);
CREATE INDEX idx_law_infractions_severity ON law_infractions(severity);
CREATE INDEX idx_law_infractions_slug ON law_infractions(slug);

CREATE TABLE jurisdiction_infraction_overrides (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  jurisdiction_id     INTEGER NOT NULL REFERENCES law_jurisdictions(id),
  infraction_id       INTEGER NOT NULL REFERENCES law_infractions(id),
  overrides_json      TEXT,
  game_version_id     INTEGER NOT NULL REFERENCES game_versions(id),
  created_at          TEXT    DEFAULT (datetime('now')),
  updated_at          TEXT    DEFAULT (datetime('now')),
  UNIQUE(jurisdiction_id, infraction_id, game_version_id)
);
CREATE INDEX idx_jio_jurisdiction ON jurisdiction_infraction_overrides(jurisdiction_id);
CREATE INDEX idx_jio_infraction ON jurisdiction_infraction_overrides(infraction_id);
