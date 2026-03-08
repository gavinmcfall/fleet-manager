-- Shop-to-location junction table
-- Links shops to their physical locations in the star map
-- Populated from LayerBackups.xml SuperName hierarchy chains

CREATE TABLE IF NOT EXISTS shop_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  location_id INTEGER NOT NULL REFERENCES star_map_locations(id),
  placement_name TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  UNIQUE(shop_id, location_id, game_version_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_locations_shop ON shop_locations(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_locations_location ON shop_locations(location_id);
