-- Index on loot_map.class_name for NPC loadout item JOIN performance
-- The NPC loadout items query JOINs on class_name = 'EntityClassDefinition.' || item_name
-- Without this index, civilian faction (8,221 items × 5,294 loot_map) causes timeouts
CREATE INDEX IF NOT EXISTS idx_loot_map_class_name ON loot_map(class_name);
