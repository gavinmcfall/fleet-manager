-- Damage types (6 types) and armor resistance profiles
-- No FK dependencies on other new tables

CREATE TABLE damage_types (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid  TEXT    NOT NULL UNIQUE,
  name  TEXT    NOT NULL,
  slug  TEXT
);

CREATE TABLE armor_resistance_profiles (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  physical          REAL,
  energy            REAL,
  distortion        REAL,
  thermal           REAL,
  biochemical       REAL,
  stun              REAL,
  impact_force      REAL,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);
