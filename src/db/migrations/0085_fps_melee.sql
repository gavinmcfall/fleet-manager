-- New table for FPS melee weapons (knives, tools, etc.)
CREATE TABLE fps_melee (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT NOT NULL,
  name              TEXT NOT NULL,
  display_name      TEXT,
  slug              TEXT,
  class_name        TEXT,
  manufacturer_id   INTEGER REFERENCES manufacturers(id),
  sub_type          TEXT,
  size              INTEGER,
  description       TEXT,
  damage            REAL,
  damage_type       TEXT,
  attack_speed      REAL,
  range             REAL,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);

CREATE INDEX idx_fps_melee_manufacturer ON fps_melee(manufacturer_id);
CREATE INDEX idx_fps_melee_version ON fps_melee(game_version_id);
