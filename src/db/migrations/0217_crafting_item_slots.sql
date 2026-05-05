-- 0217_crafting_item_slots.sql
-- Add slot_type discriminator + item_class for CraftingCost_Item slots.
-- Pipeline pre-0217 only handled CraftingCost_Resource and silently dropped
-- 123 slots that use CraftingCost_Item (sniper blueprints + other rifles).
-- Default 'resource' on existing rows preserves current behaviour. New
-- columns let the UI render Item slots distinctively (mineral icon vs gem).

ALTER TABLE crafting_blueprint_slots
  ADD COLUMN slot_type TEXT NOT NULL DEFAULT 'resource';

ALTER TABLE crafting_blueprint_slots
  ADD COLUMN item_class TEXT;

-- Mirror on the PTU shadow table (created in 0216).
ALTER TABLE ptu_crafting_blueprint_slots
  ADD COLUMN slot_type TEXT NOT NULL DEFAULT 'resource';

ALTER TABLE ptu_crafting_blueprint_slots
  ADD COLUMN item_class TEXT;
