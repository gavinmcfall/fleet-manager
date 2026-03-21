-- 0140_stable_ptu_versions.sql
--
-- Add build_number column to game_versions for PTU build tracking.
-- PTU/EPTU versions get stable codes (e.g., "4.7.0-ptu" without build number)
-- so user preferences survive PTU data refreshes.
--
-- Changes:
--   1. Add build_number TEXT column
--   2. Backfill build_number from existing codes
--   3. Consolidate duplicate PTU/EPTU rows (delete old data in FK-safe order, then old rows)
--   4. Strip build number from surviving PTU/EPTU codes

-- Step 1: Add the column
ALTER TABLE game_versions ADD COLUMN build_number TEXT;

-- Step 2: Backfill build_number for codes that have a dot after the channel separator.
-- Format: "4.7.0-ptu.11475995" -> build_number = "11475995"
UPDATE game_versions
SET build_number = SUBSTR(code, INSTR(code, '-') + INSTR(SUBSTR(code, INSTR(code, '-')), '.'))
WHERE INSTR(code, '-') > 0
  AND INSTR(SUBSTR(code, INSTR(code, '-')), '.') > 0;

-- Step 3: Consolidate duplicate PTU/EPTU rows.
-- Old PTU data is superseded by newest build. Delete all data from non-canonical
-- (non-max-id) rows in FK-safe order (children before parents), then delete the rows.
-- Safe if 0 or 1 PTU rows exist per channel (DELETE affects 0 rows).

-- Child tables (no game_version_id, delete via FK to versioned parent)
DELETE FROM crafting_slot_modifiers WHERE crafting_blueprint_slot_id IN (SELECT id FROM crafting_blueprint_slots WHERE crafting_blueprint_id IN (SELECT id FROM crafting_blueprints WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id))));
DELETE FROM crafting_blueprint_slots WHERE crafting_blueprint_id IN (SELECT id FROM crafting_blueprints WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id)));
DELETE FROM mining_location_deposits WHERE mining_location_id IN (SELECT id FROM mining_locations WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id)));
DELETE FROM salvageable_ship_components WHERE salvageable_ship_id IN (SELECT id FROM salvageable_ships WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id)));

-- Versioned tables in FK-safe order (children before parents)
DELETE FROM vehicle_weapon_racks WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM vehicle_suit_lockers WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM vehicle_ports WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM salvageable_ships WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM vehicle_roles WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM vehicle_careers WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM loot_item_locations WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM loot_map WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM vehicle_components WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM trade_commodities WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM shop_locations WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM shop_inventory WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM commodity_shop_listings WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM shops WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM missions WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM mission_givers WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM star_map_locations WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM star_systems WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM ship_missiles WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM rock_compositions WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM reputation_perks WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM reputation_standings WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM faction_reputation_scopes WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM reputation_scopes WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM reputation_reward_tiers WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM refining_processes WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM props WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM npc_loadout_items WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM npc_loadouts WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM mission_types WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM mission_organizations WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM mining_quality_distributions WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM mining_modules WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM mining_locations WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM mining_lasers WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM mining_gadgets WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM mining_clustering_presets WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM mineable_elements WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM fps_weapons WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM fps_utilities WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM fps_melee WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM fps_helmets WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM fps_clothing WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM fps_attachments WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM fps_armour WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM fps_ammo WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM consumables WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM vehicles WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM manufacturers WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM jurisdiction_infraction_overrides WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM law_jurisdictions WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM law_infractions WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM harvestables WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM fps_carryables WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM fps_ammo_types WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM factions WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM damage_types WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM crafting_resources WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM crafting_blueprints WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM contracts WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM consumable_effects WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM commodities WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));
DELETE FROM armor_resistance_profiles WHERE game_version_id IN (SELECT gv.id FROM game_versions gv WHERE gv.channel IN ('PTU','EPTU') AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = gv.channel AND g2.id > gv.id));

-- Delete old (non-canonical) PTU/EPTU game_versions rows
DELETE FROM game_versions
WHERE channel IN ('PTU', 'EPTU')
  AND EXISTS (SELECT 1 FROM game_versions g2 WHERE g2.channel = game_versions.channel AND g2.id > game_versions.id);

-- Step 4: Strip build number from surviving PTU/EPTU codes to make them stable.
-- "4.7.0-ptu.11475995" -> "4.7.0-ptu"
UPDATE game_versions
SET code = SUBSTR(code, 1, INSTR(code, '-') + INSTR(SUBSTR(code, INSTR(code, '-')), '.') - 2)
WHERE channel IN ('PTU', 'EPTU')
  AND INSTR(SUBSTR(code, INSTR(code, '-')), '.') > 0;
