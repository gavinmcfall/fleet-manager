-- Vehicle modules: available module options per ship port.
-- Modules are swappable items (AttachDef.Type = "Module") on ships like the
-- Retaliator (torpedo/cargo/base bays), Apollo (medical tiers), Cyclone variants, etc.
-- Each row represents one compatible module for one vehicle port.

CREATE TABLE vehicle_modules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  vehicle_id      INTEGER NOT NULL REFERENCES vehicles(id),
  port_name       TEXT    NOT NULL,
  class_name      TEXT    NOT NULL,
  display_name    TEXT,
  size            INTEGER,
  tags            TEXT,
  is_default      INTEGER NOT NULL DEFAULT 0,
  has_loadout     INTEGER NOT NULL DEFAULT 0,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  created_at      TEXT    DEFAULT (datetime('now')),
  removed         INTEGER NOT NULL DEFAULT 0,
  UNIQUE(uuid, vehicle_id, game_version_id)
);

CREATE INDEX idx_vehicle_modules_vehicle ON vehicle_modules(vehicle_id);
CREATE INDEX idx_vehicle_modules_port ON vehicle_modules(vehicle_id, port_name);
CREATE INDEX idx_vehicle_modules_version ON vehicle_modules(game_version_id);
