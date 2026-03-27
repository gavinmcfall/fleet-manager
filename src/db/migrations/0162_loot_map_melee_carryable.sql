-- Add FK columns for fps_melee and fps_carryables tables on loot_map
-- Melee weapons (28 knives) are currently misrouted to fps_weapons via WeaponPersonal type
-- Carryables (1,614 items) have no FK column at all

ALTER TABLE loot_map ADD COLUMN fps_melee_id INTEGER REFERENCES fps_melee(id);
ALTER TABLE loot_map ADD COLUMN fps_carryable_id INTEGER REFERENCES fps_carryables(id);

CREATE INDEX idx_loot_map_fps_melee ON loot_map(fps_melee_id);
CREATE INDEX idx_loot_map_fps_carryable ON loot_map(fps_carryable_id);
