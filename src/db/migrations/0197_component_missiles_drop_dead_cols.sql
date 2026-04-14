-- Migration 0197: Drop dead ammo-stat columns from component_missiles.
-- component_missiles is the RACK component sub-table. These 6 columns belong
-- to the ammo (ship_missiles), not the rack. Racks only hold ammo_count
-- (capacity) and missile_type (what kinds it accepts).
--
-- Dead columns: lock_time, tracking_signal, damage, blast_radius, speed, lock_range
-- These were duplicated during the 0179 100-col split but were never populated
-- on the rack side and no query reads them from this table.

PRAGMA foreign_keys = OFF;

CREATE TABLE component_missiles_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  ammo_count INTEGER,
  missile_type TEXT,
  UNIQUE(component_id, game_version_id)
);

INSERT INTO component_missiles_new (id, component_id, game_version_id, ammo_count, missile_type)
SELECT id, component_id, game_version_id, ammo_count, missile_type
FROM component_missiles;

DROP TABLE component_missiles;
ALTER TABLE component_missiles_new RENAME TO component_missiles;

CREATE INDEX idx_component_missiles_cid ON component_missiles(component_id);

PRAGMA foreign_keys = ON;
