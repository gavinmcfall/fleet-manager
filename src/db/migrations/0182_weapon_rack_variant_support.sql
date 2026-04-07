-- Allow the same weapon rack to be linked to multiple vehicle variants.
-- E.g. Weapon_Rack_DRAK_Corsair belongs to both Drake Corsair and Corsair PYAM Exec.
-- Old UNIQUE(uuid, game_version_id) prevented this; new UNIQUE includes vehicle_id.

ALTER TABLE vehicle_weapon_racks RENAME TO _vehicle_weapon_racks_old;

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
  removed           INTEGER NOT NULL DEFAULT 0,
  vehicle_name      TEXT,
  entity_name       TEXT,
  port_name         TEXT,
  rack_type         TEXT,
  data_source       TEXT,
  UNIQUE(uuid, vehicle_id, game_version_id)
);

INSERT INTO vehicle_weapon_racks (id, vehicle_id, rack_entity_name, uuid, rack_label,
  total_ports, rifle_ports, pistol_ports, heavy_ports, utility_ports, min_size, max_size,
  game_version_id, removed, vehicle_name, entity_name, port_name, rack_type, data_source)
SELECT id, vehicle_id, rack_entity_name, uuid, rack_label,
  total_ports, rifle_ports, pistol_ports, heavy_ports, utility_ports, min_size, max_size,
  game_version_id, removed, vehicle_name, entity_name, port_name, rack_type, data_source
FROM _vehicle_weapon_racks_old;

DROP TABLE _vehicle_weapon_racks_old;

CREATE INDEX idx_vehicle_weapon_racks_vehicle ON vehicle_weapon_racks(vehicle_id);
CREATE INDEX idx_vehicle_weapon_racks_version ON vehicle_weapon_racks(game_version_id);

-- Same fix for suit lockers — allow same locker on multiple vehicle variants.
ALTER TABLE vehicle_suit_lockers RENAME TO _vehicle_suit_lockers_old;

CREATE TABLE vehicle_suit_lockers (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id         INTEGER REFERENCES vehicles(id),
  locker_entity_name TEXT NOT NULL,
  uuid               TEXT NOT NULL,
  locker_label       TEXT,
  locker_count       INTEGER DEFAULT 1,
  game_version_id    INTEGER NOT NULL REFERENCES game_versions(id),
  removed            INTEGER NOT NULL DEFAULT 0,
  vehicle_name       TEXT,
  data_source        TEXT,
  UNIQUE(uuid, vehicle_id, game_version_id)
);

INSERT INTO vehicle_suit_lockers (id, vehicle_id, locker_entity_name, uuid, locker_label,
  locker_count, game_version_id, removed, vehicle_name, data_source)
SELECT id, vehicle_id, locker_entity_name, uuid, locker_label,
  locker_count, game_version_id, removed, vehicle_name, data_source
FROM _vehicle_suit_lockers_old;

DROP TABLE _vehicle_suit_lockers_old;

CREATE INDEX idx_vehicle_suit_lockers_vehicle ON vehicle_suit_lockers(vehicle_id);
CREATE INDEX idx_vehicle_suit_lockers_version ON vehicle_suit_lockers(game_version_id);
