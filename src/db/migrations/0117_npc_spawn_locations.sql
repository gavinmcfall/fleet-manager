-- Add spawn_locations column to loot_item_locations for NPC rows.
-- Stores JSON array of location template names where the NPC spawns.
-- Only populated for NPCs with known spawn points from mission templates.
-- Example: '["ASDFacility_WingA-Power","Outpost_ASD_ResearchFacility_Pyro1"]'

ALTER TABLE loot_item_locations ADD COLUMN spawn_locations TEXT;
