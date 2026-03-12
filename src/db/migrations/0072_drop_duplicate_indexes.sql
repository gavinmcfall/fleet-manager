-- Drop duplicate loot_map indexes. Migrations 0020/0022 created idx_loot_map_fps_helmet
-- and idx_loot_map_fps_clothing, then migration 0047 created idx_loot_map_fps_helmet_id
-- and idx_loot_map_fps_clothing_id on the same columns. Keep the _id-suffixed ones
-- for naming consistency with idx_{table}_{column} convention.

DROP INDEX IF EXISTS idx_loot_map_fps_helmet;
DROP INDEX IF EXISTS idx_loot_map_fps_clothing;
