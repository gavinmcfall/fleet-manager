-- Denormalize loot_map JSON blob columns into junction table.
-- Replaces containers_json, shops_json, npcs_json, contracts_json with
-- indexed loot_item_locations rows. Same pattern as stats_json elimination.
-- Extraction scripts will populate the new table; JSON columns are dropped.

-- Delete old game version data (not default, frees space)
-- Must delete dependent rows first (FK constraints)
DELETE FROM npc_loadout_items WHERE game_version_id NOT IN (
  SELECT id FROM game_versions WHERE is_default = 1
);
DELETE FROM npc_loadouts WHERE game_version_id NOT IN (
  SELECT id FROM game_versions WHERE is_default = 1
);
DELETE FROM user_loot_collection WHERE loot_map_id IN (
  SELECT id FROM loot_map WHERE game_version_id NOT IN (
    SELECT id FROM game_versions WHERE is_default = 1
  )
);
DELETE FROM user_loot_wishlist WHERE loot_map_id IN (
  SELECT id FROM loot_map WHERE game_version_id NOT IN (
    SELECT id FROM game_versions WHERE is_default = 1
  )
);
DELETE FROM loot_map WHERE game_version_id NOT IN (
  SELECT id FROM game_versions WHERE is_default = 1
);

CREATE TABLE loot_item_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loot_map_id INTEGER NOT NULL REFERENCES loot_map(id),
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  source_type TEXT NOT NULL CHECK(source_type IN ('container','shop','npc','contract')),
  location_key TEXT NOT NULL,
  -- Container fields
  location_tag TEXT,
  container_type TEXT,
  per_container REAL,
  per_roll REAL,
  rolls INTEGER,
  loot_table TEXT,
  -- Shop fields
  buy_price REAL,
  sell_price REAL,
  -- NPC fields
  actor TEXT,
  faction TEXT,
  slot TEXT,
  probability REAL,
  -- Contract fields
  contract_name TEXT,
  guild TEXT,
  reward_type TEXT,
  amount REAL,
  weight REAL
);

CREATE INDEX idx_loot_item_locations_source_key ON loot_item_locations(source_type, location_key);
CREATE INDEX idx_loot_item_locations_loot_map ON loot_item_locations(loot_map_id);
CREATE INDEX idx_loot_item_locations_version ON loot_item_locations(game_version_id);

ALTER TABLE loot_map DROP COLUMN containers_json;
ALTER TABLE loot_map DROP COLUMN shops_json;
ALTER TABLE loot_map DROP COLUMN npcs_json;
ALTER TABLE loot_map DROP COLUMN contracts_json;
