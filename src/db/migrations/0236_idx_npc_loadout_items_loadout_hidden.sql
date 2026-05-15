-- Composite index for s06 visible_item_count recompute and loadout-detail queries.
--
-- 2026-05-15 prod cutover post-load: the s06 statement
--   UPDATE npc_loadouts SET visible_item_count = (
--     SELECT COUNT(*) FROM npc_loadout_items
--     WHERE loadout_id = npc_loadouts.id AND is_hidden = 0
--   );
-- exceeded D1's 30s per-DO-request CPU budget and triggered D1_RESET_DO.
--
-- EXPLAIN QUERY PLAN revealed SQLite was picking idx_npc_loadout_items_hidden
-- (is_hidden, 2 distinct values, ~50% of rows match each value) over
-- idx_npc_loadout_items_loadout (loadout_id, ~3035 distinct values).
-- Per-iteration cost: scan ~10k is_hidden=0 rows then filter by loadout_id.
-- Across 3,035 npc_loadouts UPDATE iterations: ~30M comparisons → CPU cliff.
--
-- Composite (loadout_id, is_hidden) gives SQLite a point lookup on both
-- columns. Per-iteration cost drops to O(log n) + small bounded scan.
-- Total ~3035 × ~5 row touches = ~15k = well under 30s budget.

CREATE INDEX IF NOT EXISTS idx_npc_loadout_items_loadout_hidden
  ON npc_loadout_items(loadout_id, is_hidden);
