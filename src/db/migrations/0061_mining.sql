-- Mining system: elements, rock compositions, refining processes
-- Depends on: commodities (0057)

CREATE TABLE mineable_elements (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  class_name        TEXT,
  category          TEXT,
  commodity_id      INTEGER REFERENCES commodities(id),
  stats_json        TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);
CREATE INDEX idx_mineable_elements_category ON mineable_elements(category);
CREATE INDEX idx_mineable_elements_slug ON mineable_elements(slug);

CREATE TABLE rock_compositions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  class_name        TEXT,
  rock_type         TEXT,
  min_elements      INTEGER,
  composition_json  TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);
CREATE INDEX idx_rock_compositions_rock_type ON rock_compositions(rock_type);

CREATE TABLE refining_processes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  speed             TEXT    NOT NULL,
  quality           TEXT    NOT NULL,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);
