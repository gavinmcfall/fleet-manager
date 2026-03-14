-- Vehicle suit lockers — per-ship suit storage from DataCore
CREATE TABLE vehicle_suit_lockers (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id         INTEGER REFERENCES vehicles(id),
  locker_entity_name TEXT NOT NULL,
  uuid               TEXT NOT NULL,
  locker_label       TEXT,
  locker_count       INTEGER DEFAULT 1,
  game_version_id    INTEGER NOT NULL REFERENCES game_versions(id),
  UNIQUE(uuid, game_version_id)
);

CREATE INDEX idx_vehicle_suit_lockers_vehicle ON vehicle_suit_lockers(vehicle_id);
CREATE INDEX idx_vehicle_suit_lockers_version ON vehicle_suit_lockers(game_version_id);
