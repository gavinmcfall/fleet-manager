-- Add denormalized columns to npc_loadout_items for fast detail queries.
-- Populated via batched SQL after migration (too many rows for single UPDATE).

ALTER TABLE npc_loadout_items ADD COLUMN resolved_name TEXT;
ALTER TABLE npc_loadout_items ADD COLUMN loot_item_id INTEGER;
ALTER TABLE npc_loadout_items ADD COLUMN manufacturer_name TEXT;
