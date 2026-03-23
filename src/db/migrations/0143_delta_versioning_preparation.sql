-- Delta versioning preparation: add `removed` column to all versioned tables.
-- This enables the "latest version up to X" query pattern where items can be
-- tombstoned (removed=1) in a newer version without deleting the base row.
--
-- Tables that already have `removed`: loot_map (added in 0049)
-- Tables that don't need it: junction tables that follow parent (loot_item_locations,
--   shop_inventory, crafting_blueprint_slots, crafting_slot_modifiers, etc.)

-- FPS gear tables
ALTER TABLE fps_weapons ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fps_armour ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fps_helmets ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fps_clothing ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fps_attachments ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fps_utilities ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fps_melee ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fps_ammo_types ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fps_carryables ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;

-- Vehicle tables
ALTER TABLE vehicles ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vehicle_components ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vehicle_weapon_racks ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vehicle_suit_lockers ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vehicle_ports ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;

-- Ship tables
ALTER TABLE ship_missiles ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE salvageable_ships ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;

-- Reference data
ALTER TABLE manufacturers ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE factions ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shops ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE trade_commodities ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contracts ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE consumables ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE props ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE harvestables ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE missions ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE star_map_locations ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE star_systems ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;

-- Reputation / Law
ALTER TABLE reputation_scopes ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reputation_standings ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reputation_perks ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reputation_reward_tiers ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE law_infractions ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE law_jurisdictions ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;

-- Mining
ALTER TABLE mining_locations ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mining_clustering_presets ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mining_quality_distributions ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mining_lasers ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mining_modules ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mining_gadgets ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mineable_elements ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rock_compositions ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE refining_processes ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;

-- Crafting
ALTER TABLE crafting_blueprints ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE crafting_resources ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;

-- Other versioned tables
ALTER TABLE damage_types ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE armor_resistance_profiles ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE commodities ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE consumable_effects ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vehicle_careers ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vehicle_roles ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE npc_loadouts ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fps_ammo ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
