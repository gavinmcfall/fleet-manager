-- 0190_add_missing_unique_constraints.sql
-- Add UNIQUE constraints to tables that lacked them, enabling proper UPSERT
-- instead of INSERT OR IGNORE (which created duplicates every pipeline load).

-- ── loot_item_locations ──────────────────────────────────────────────
-- Natural key: which item, from what source, at what location + grade.
-- Same item can appear at same location with different grades (GRADE C vs D).
-- UPSERT updates probability on conflict.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lil_natural_key
  ON loot_item_locations(loot_map_id, source_type, location_key, COALESCE(location_label, ''));

-- ── npc_loadout_items ────────────────────────────────────────────────
-- Natural key: which loadout, which item, which slot.
CREATE UNIQUE INDEX IF NOT EXISTS idx_nli_natural_key
  ON npc_loadout_items(loadout_id, item_name, COALESCE(slot, ''));

-- ── mining_gadgets ───────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_mining_gadgets_name
  ON mining_gadgets(name);

-- ── mining_lasers ────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_mining_lasers_name
  ON mining_lasers(name);

-- ── mining_modules ───────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_mining_modules_name
  ON mining_modules(name);

-- ── mining_locations ─────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_mining_locations_key
  ON mining_locations(preset_file, name);

-- ── mining_quality_distributions ─────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_mining_qd_name
  ON mining_quality_distributions(name);
