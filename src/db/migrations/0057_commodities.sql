-- Commodities: tradeable goods (206+ items)
-- No FK dependencies on other new tables

CREATE TABLE commodities (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  class_name        TEXT,
  description       TEXT,
  category          TEXT    NOT NULL,
  sub_category      TEXT,
  occupancy_cscu    INTEGER,
  is_illegal        INTEGER DEFAULT 0,
  is_raw            INTEGER DEFAULT 0,
  is_boxable        INTEGER DEFAULT 0,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);
CREATE INDEX idx_commodities_category ON commodities(category);
CREATE INDEX idx_commodities_slug ON commodities(slug);
