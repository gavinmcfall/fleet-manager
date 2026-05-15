-- Recreate two UNIQUE indexes with COALESCE wrapping so ON CONFLICT clauses
-- in pipeline-emitted UPSERTs match.
--
-- Migration 0190 originally created these indexes WITHOUT COALESCE. The
-- migration source was later updated to add `COALESCE(col, '')` so that
-- NULL values participate in uniqueness, but every staging+production D1
-- already had the old index from the first apply, and `IF NOT EXISTS`
-- meant the rewrite never landed.
--
-- Symptom: v2 pipeline `INSERT ... ON CONFLICT(loadout_id, item_name,
-- COALESCE(slot, ''))` errors with generic `constraint: SQLITE_ERROR`
-- because the unique-index expression doesn't match. The npc_loadout_items
-- + loot_item_locations FK steps in load_staging.py have been silently
-- failing on every staging patch load since at least 2026-05-08.
--
-- The PTU shadow versions (ptu_idx_*_natural_key, created fresh in 0215)
-- already have COALESCE — only the base-table indexes need fixing.
--
-- Verified actual remote schema 2026-05-15:
--   idx_nli_natural_key ON npc_loadout_items(loadout_id, item_name, slot)
--   idx_lil_natural_key ON loot_item_locations(loot_map_id, source_type, location_key, location_label)
-- Both missing COALESCE wrapping on the last column.

DROP INDEX IF EXISTS idx_nli_natural_key;
CREATE UNIQUE INDEX idx_nli_natural_key
  ON npc_loadout_items(loadout_id, item_name, COALESCE(slot, ''));

DROP INDEX IF EXISTS idx_lil_natural_key;
CREATE UNIQUE INDEX idx_lil_natural_key
  ON loot_item_locations(loot_map_id, source_type, location_key, COALESCE(location_label, ''));
