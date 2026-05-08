-- 0221_add_is_npc_only.sql
--
-- Adds an `is_npc_only` flag on vehicles + ptu_vehicles to discriminate
-- pure-NPC variants (Vanduul Mauler, AI defendship spawns, mission AI
-- templates) from real player-obtainable ships.
--
-- The previous gating signal was `is_pledgeable`, which is true ONLY for
-- ships listed on the RSI pledge store. That excludes legitimate
-- player-obtainable but non-pledgeable ships like Krig L-22 Wikelo War
-- Special, Drake Command Module (detachable from Caterpillar/Ironclad),
-- BIS edition variants, and mission-reward variants. Browsing UIs need
-- to show those. They only need to hide categories like:
--   - `_pu_ai_*` / `_ai_*` (mission-spawn AI variants)
--   - `defendship` / `_xnaa` (defenseship AI)
--   - `vncl_*` (Vanduul faction enemy ships)
--
-- Population is done via UPDATE in the same migration so existing rows
-- get classified immediately.

ALTER TABLE vehicles ADD COLUMN is_npc_only INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ptu_vehicles ADD COLUMN is_npc_only INTEGER NOT NULL DEFAULT 0;

-- Populate based on class_name patterns. These are conservative: only
-- match strong NPC indicators. Anything ambiguous stays is_npc_only=0
-- so it remains visible in the ship browser.
UPDATE vehicles
SET is_npc_only = 1
WHERE LOWER(class_name) LIKE '%_pu_ai_%'
   OR LOWER(class_name) LIKE '%_ai_civ%'
   OR LOWER(class_name) LIKE '%_ai_crim%'
   OR LOWER(class_name) LIKE '%_ai_military%'
   OR LOWER(class_name) LIKE '%defendship%'
   OR LOWER(class_name) LIKE '%_xnaa%'
   OR LOWER(class_name) LIKE 'vncl_%';

UPDATE ptu_vehicles
SET is_npc_only = 1
WHERE LOWER(class_name) LIKE '%_pu_ai_%'
   OR LOWER(class_name) LIKE '%_ai_civ%'
   OR LOWER(class_name) LIKE '%_ai_crim%'
   OR LOWER(class_name) LIKE '%_ai_military%'
   OR LOWER(class_name) LIKE '%defendship%'
   OR LOWER(class_name) LIKE '%_xnaa%'
   OR LOWER(class_name) LIKE 'vncl_%';

CREATE INDEX IF NOT EXISTS idx_vehicles_is_npc_only ON vehicles(is_npc_only);
CREATE INDEX IF NOT EXISTS ptu_idx_vehicles_is_npc_only ON ptu_vehicles(is_npc_only);
