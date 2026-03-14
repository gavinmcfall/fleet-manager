-- Vehicle weapon racks — per-ship personal weapon storage from DataCore
CREATE TABLE vehicle_weapon_racks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id        INTEGER REFERENCES vehicles(id),
  rack_entity_name  TEXT NOT NULL,
  uuid              TEXT NOT NULL,
  rack_label        TEXT,
  total_ports       INTEGER NOT NULL DEFAULT 0,
  rifle_ports       INTEGER NOT NULL DEFAULT 0,
  pistol_ports      INTEGER NOT NULL DEFAULT 0,
  heavy_ports       INTEGER NOT NULL DEFAULT 0,
  utility_ports     INTEGER NOT NULL DEFAULT 0,
  min_size          INTEGER,
  max_size          INTEGER,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  UNIQUE(uuid, game_version_id)
);

CREATE INDEX idx_vehicle_weapon_racks_vehicle ON vehicle_weapon_racks(vehicle_id);
CREATE INDEX idx_vehicle_weapon_racks_version ON vehicle_weapon_racks(game_version_id);
