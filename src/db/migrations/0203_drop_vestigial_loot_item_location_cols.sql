-- 0203_drop_vestigial_loot_item_location_cols.sql
--
-- Drop 9 columns from loot_item_locations that are 100% NULL and whose data
-- lives canonically in other tables. These were never populated by the current
-- extractor and are relics from an earlier schema.
--
-- Column → canonical replacement:
--   buy_price, sell_price                    → terminal_inventory (three-layer shop model, migrations 0184-0185)
--   contract_name, guild, reward_type,
--   reward_amount, reward_max, amount        → contracts + contract_generator_contracts
--   location_tag                             → vestigial; frontend already has location_key fallback chain
--
-- Readers (loadout.ts shop queries, queries.ts loot-detail SELECT,
-- lootHelpers.js label builder) are updated in follow-up task #110.

ALTER TABLE loot_item_locations DROP COLUMN buy_price;
ALTER TABLE loot_item_locations DROP COLUMN sell_price;
ALTER TABLE loot_item_locations DROP COLUMN contract_name;
ALTER TABLE loot_item_locations DROP COLUMN guild;
ALTER TABLE loot_item_locations DROP COLUMN reward_type;
ALTER TABLE loot_item_locations DROP COLUMN reward_amount;
ALTER TABLE loot_item_locations DROP COLUMN reward_max;
ALTER TABLE loot_item_locations DROP COLUMN amount;
ALTER TABLE loot_item_locations DROP COLUMN location_tag;
