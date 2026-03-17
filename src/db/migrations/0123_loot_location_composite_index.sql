-- Composite index for LOOT_HAS_FLAGS correlated subqueries.
-- Each getLootItems call runs 4 EXISTS subqueries per item:
--   EXISTS(SELECT 1 FROM loot_item_locations WHERE loot_map_id = ? AND source_type = ?)
-- The existing idx_loot_item_locations_loot_map only covers loot_map_id.
-- This composite index makes each EXISTS an index-only lookup on 1M+ rows.
CREATE INDEX IF NOT EXISTS idx_loot_item_locations_map_source
  ON loot_item_locations(loot_map_id, source_type);
