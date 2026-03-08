-- Mission infrastructure: givers, types, organizations
-- Depends on: factions (0058), star_map_locations (0060)

CREATE TABLE mission_givers (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  description       TEXT,
  faction_id        INTEGER REFERENCES factions(id),
  location_id       INTEGER REFERENCES star_map_locations(id),
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);
CREATE INDEX idx_mission_givers_slug ON mission_givers(slug);
CREATE INDEX idx_mission_givers_faction ON mission_givers(faction_id);
CREATE INDEX idx_mission_givers_location ON mission_givers(location_id);

CREATE TABLE mission_types (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  description       TEXT,
  category          TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);
CREATE INDEX idx_mission_types_category ON mission_types(category);

CREATE TABLE mission_organizations (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  description       TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);
CREATE INDEX idx_mission_organizations_slug ON mission_organizations(slug);
