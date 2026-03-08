-- Star systems and star map locations (hierarchical)
-- Depends on: law_jurisdictions (0059)

CREATE TABLE star_systems (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  code              TEXT,
  description       TEXT,
  galactic_x        REAL,
  galactic_y        REAL,
  galactic_z        REAL,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);

CREATE TABLE star_map_locations (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                  TEXT    NOT NULL,
  name                  TEXT    NOT NULL,
  slug                  TEXT,
  description           TEXT,
  location_type         TEXT    NOT NULL,
  nav_icon              TEXT,
  parent_uuid           TEXT,
  star_system_id        INTEGER REFERENCES star_systems(id),
  jurisdiction_id       INTEGER REFERENCES law_jurisdictions(id),
  size_meters           REAL,
  qt_obstruction_radius REAL,
  qt_arrival_radius     REAL,
  qt_adoption_radius    REAL,
  respawn_type          TEXT,
  is_scannable          INTEGER DEFAULT 0,
  hide_in_starmap       INTEGER DEFAULT 0,
  amenities_json        TEXT,
  game_version_id       INTEGER NOT NULL REFERENCES game_versions(id),
  created_at            TEXT    DEFAULT (datetime('now')),
  updated_at            TEXT    DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);
CREATE INDEX idx_star_map_locations_type ON star_map_locations(location_type);
CREATE INDEX idx_star_map_locations_parent ON star_map_locations(parent_uuid);
CREATE INDEX idx_star_map_locations_jurisdiction ON star_map_locations(jurisdiction_id);
CREATE INDEX idx_star_map_locations_system ON star_map_locations(star_system_id);
CREATE INDEX idx_star_map_locations_slug ON star_map_locations(slug);
