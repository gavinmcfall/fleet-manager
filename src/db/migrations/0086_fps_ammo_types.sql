-- New table for FPS ammo/magazine types
CREATE TABLE fps_ammo_types (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid               TEXT NOT NULL,
  name               TEXT NOT NULL,
  display_name       TEXT,
  slug               TEXT,
  class_name         TEXT,
  caliber            TEXT,
  damage_per_round   REAL,
  damage_type        TEXT,
  projectile_speed   REAL,
  magazine_capacity  INTEGER,
  game_version_id    INTEGER NOT NULL REFERENCES game_versions(id),
  created_at         TEXT DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);

CREATE INDEX idx_fps_ammo_types_version ON fps_ammo_types(game_version_id);
