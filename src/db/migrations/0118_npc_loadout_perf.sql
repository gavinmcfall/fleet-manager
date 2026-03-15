-- Pre-compute hidden status on items and visible counts on loadouts
-- so faction list/detail queries don't need expensive LIKE pattern matching.

-- is_hidden reasons (applied in order during extraction/post-processing):
--   1. Body/cosmetic item name patterns (Head_, Hair_, m_body_, f_body_, etc.)
--   2. System items (MobiGlas, FPS_Default, invisible_, etc.)
--   3. Body/cosmetic tags (Char_Body, Char_Accessory_Head, Char_Accessory_Eyes)
--   4. Skin variants (Female_Skin_Var_*, Skin_Var_*, clothing_undersuit)
--   5. Corpse/internal loadouts (corpsebodies_*, regen_boss_*, SQ42 templates)
--   6. No game entity UUID — item has no EntityClassDefinition in DataCore,
--      meaning it cannot be looted, equipped, or interacted with. These are
--      internal/dev items or deprecated entities.
ALTER TABLE npc_loadout_items ADD COLUMN is_hidden INTEGER DEFAULT 0;

UPDATE npc_loadout_items SET is_hidden = 1
WHERE item_name LIKE 'Head\_%' ESCAPE '\'
   OR item_name LIKE 'Hair\_%' ESCAPE '\'
   OR item_name LIKE 'm\_body\_%' ESCAPE '\'
   OR item_name LIKE 'f\_body\_%' ESCAPE '\'
   OR item_name LIKE 'PU\_Protos\_%' ESCAPE '\'
   OR item_name LIKE 'PU\_Head\_%' ESCAPE '\'
   OR item_name LIKE 'collector\_body%' ESCAPE '\'
   OR item_name LIKE 'collector\_head%' ESCAPE '\'
   OR item_name LIKE 'collector\_teeth%' ESCAPE '\'
   OR item_name LIKE 'collector\_eyes%' ESCAPE '\'
   OR item_name LIKE 'MobiGlas%'
   OR item_name LIKE 'PersonalMobiGlas%'
   OR item_name LIKE 'Tattoo\_Var\_%' ESCAPE '\'
   OR item_name LIKE 'Color\_Var\_%' ESCAPE '\'
   OR item_name LIKE 'Skin\_Var\_%' ESCAPE '\'
   OR item_name LIKE 'Female\_Skin\_%' ESCAPE '\'
   OR item_name LIKE 'Shared\_Brows%' ESCAPE '\'
   OR item_name LIKE 'FPS\_Default%' ESCAPE '\'
   OR item_name LIKE 'MineableRock\_%' ESCAPE '\'
   OR item_name LIKE 'harvestable\_%' ESCAPE '\'
   OR item_name LIKE 'invisible\_%' ESCAPE '\'
   OR item_name = 'clothing_undersuit'
   OR tag IN ('Char_Body','Char_Body(Male)','Char_Body(Female)',
              'Char_Accessory_Head','Char_Accessory_Head(Vanduul)',
              'Char_Accessory_Eyes');

CREATE INDEX idx_npc_loadout_items_hidden ON npc_loadout_items(is_hidden);

-- Pre-compute visible item count per loadout
ALTER TABLE npc_loadouts ADD COLUMN visible_item_count INTEGER DEFAULT 0;

UPDATE npc_loadouts SET visible_item_count = (
  SELECT COUNT(*) FROM npc_loadout_items
  WHERE loadout_id = npc_loadouts.id AND is_hidden = 0
);
