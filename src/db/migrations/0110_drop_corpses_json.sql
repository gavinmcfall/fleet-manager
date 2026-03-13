-- Drop corpses_json from loot_map.
-- This column was never populated — game data doesn't distinguish corpse loot
-- from container loot. All corpse drops use the same container loot tables.
ALTER TABLE loot_map DROP COLUMN corpses_json;
