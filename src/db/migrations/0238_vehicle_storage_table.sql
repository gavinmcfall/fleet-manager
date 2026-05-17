-- 0238_vehicle_storage_table.sql
-- PART L Track 1 — Storage Taxonomy
-- Detail row per storage feature per vehicle. Aggregates roll up to vehicles.* summary cols (0239).
-- Six storage_type values: internal_grid | external_pod | fuel_cargo | personal_locker | suit_locker | weapon_rack

CREATE TABLE IF NOT EXISTS vehicle_storage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
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

CREATE INDEX IF NOT EXISTS idx_vehicle_storage_vehicle ON vehicle_storage(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_storage_type ON vehicle_storage(storage_type);
