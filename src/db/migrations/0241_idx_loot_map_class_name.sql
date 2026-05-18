-- 0241_idx_loot_map_class_name.sql
-- #55-3 deferred cutover backlog: index loot_map.class_name to make 09b
-- fixup joins viable next patch.
--
-- Context: load_to_cloudflare's 09b_fk_fixups step does cross-table joins on
-- class_name (e.g. npc_loadout_items.class_name → loot_map.class_name to
-- backfill loot_item_id). Without this index those joins do a full table
-- scan over loot_map (~11K rows on prod) for every row in the source — fine
-- for small patches but burns serious time during a full cutover load.
--
-- Per the May 16 cutover postmortem (see project_ship_name_manufacturer_prefix_cleanup
-- and feedback_cutover_order_code_before_data), the next p4k re-extract will
-- hit this path. Adding the index now is preemptive.

CREATE INDEX IF NOT EXISTS idx_loot_map_class_name ON loot_map(class_name);
-- ptu_loot_map index handled in a separate migration that only fires when
-- the shadow table exists (staging has periodically had PTU shadows dropped
-- via the admin purge endpoint, prod always has them). Splitting keeps this
-- migration cross-env safe.
