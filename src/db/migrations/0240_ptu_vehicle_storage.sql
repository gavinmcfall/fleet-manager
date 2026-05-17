-- 0240_ptu_vehicle_storage.sql
-- PART L Track 1 — PTU shadow for vehicle_storage (added in 0238 for LIVE).
-- Required because vehicle_storage is added to VERSIONED_TABLES; PTU channel routing expects ptu_vehicle_storage to exist.

CREATE TABLE IF NOT EXISTS ptu_vehicle_storage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL REFERENCES ptu_vehicles(id),
  storage_type TEXT NOT NULL,
  container_class_name TEXT,
  scu_capacity REAL,
  microscu_capacity REAL,
  count INTEGER DEFAULT 1,
  location_label TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  data_source TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_in_patch TEXT
);

CREATE INDEX IF NOT EXISTS idx_ptu_vehicle_storage_vehicle ON ptu_vehicle_storage(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_ptu_vehicle_storage_type ON ptu_vehicle_storage(storage_type);
