-- New table for FPS carryable items (boxes, tools, quest items)
CREATE TABLE fps_carryables (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT NOT NULL,
  name              TEXT NOT NULL,
  display_name      TEXT,
  slug              TEXT,
  class_name        TEXT,
  sub_type          TEXT,
  mass              REAL,
  interaction_type  TEXT,
  value             REAL,
  description       TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);

CREATE INDEX idx_fps_carryables_version ON fps_carryables(game_version_id);
