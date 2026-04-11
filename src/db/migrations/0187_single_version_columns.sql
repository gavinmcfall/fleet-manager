-- 0187_single_version_columns.sql
-- Single-version architecture: add soft-delete columns to all 86 versioned game-data tables.
-- Add short_slug and data_source to vehicles for dual-source merge.
--
-- Columns added per table:
--   is_deleted INTEGER DEFAULT 0  (0 = active, 1 = removed from game)
--   deleted_at TEXT               (ISO 8601 timestamp when marked deleted)
--   deleted_in_patch TEXT         (e.g. "4.7.2-live" — for "Removed in X" badge)

-- ── Soft-delete columns ──────────────────────────────────────────────

ALTER TABLE armor_resistance_profiles ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE armor_resistance_profiles ADD COLUMN deleted_at TEXT;
ALTER TABLE armor_resistance_profiles ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE commodities ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE commodities ADD COLUMN deleted_at TEXT;
ALTER TABLE commodities ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE component_coolers ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE component_coolers ADD COLUMN deleted_at TEXT;
ALTER TABLE component_coolers ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE component_mining ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE component_mining ADD COLUMN deleted_at TEXT;
ALTER TABLE component_mining ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE component_missiles ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE component_missiles ADD COLUMN deleted_at TEXT;
ALTER TABLE component_missiles ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE component_powerplants ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE component_powerplants ADD COLUMN deleted_at TEXT;
ALTER TABLE component_powerplants ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE component_qed ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE component_qed ADD COLUMN deleted_at TEXT;
ALTER TABLE component_qed ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE component_quantum_drives ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE component_quantum_drives ADD COLUMN deleted_at TEXT;
ALTER TABLE component_quantum_drives ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE component_radar ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE component_radar ADD COLUMN deleted_at TEXT;
ALTER TABLE component_radar ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE component_shields ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE component_shields ADD COLUMN deleted_at TEXT;
ALTER TABLE component_shields ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE component_thrusters ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE component_thrusters ADD COLUMN deleted_at TEXT;
ALTER TABLE component_thrusters ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE component_turrets ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE component_turrets ADD COLUMN deleted_at TEXT;
ALTER TABLE component_turrets ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE component_weapons ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE component_weapons ADD COLUMN deleted_at TEXT;
ALTER TABLE component_weapons ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE consumable_effect_types ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE consumable_effect_types ADD COLUMN deleted_at TEXT;
ALTER TABLE consumable_effect_types ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE consumable_effects ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE consumable_effects ADD COLUMN deleted_at TEXT;
ALTER TABLE consumable_effects ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE consumables ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE consumables ADD COLUMN deleted_at TEXT;
ALTER TABLE consumables ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE contract_blueprint_reward_pools ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE contract_blueprint_reward_pools ADD COLUMN deleted_at TEXT;
ALTER TABLE contract_blueprint_reward_pools ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE contract_generator_blueprint_pools ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE contract_generator_blueprint_pools ADD COLUMN deleted_at TEXT;
ALTER TABLE contract_generator_blueprint_pools ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE contract_generator_careers ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE contract_generator_careers ADD COLUMN deleted_at TEXT;
ALTER TABLE contract_generator_careers ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE contract_generator_contracts ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE contract_generator_contracts ADD COLUMN deleted_at TEXT;
ALTER TABLE contract_generator_contracts ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE contract_generators ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE contract_generators ADD COLUMN deleted_at TEXT;
ALTER TABLE contract_generators ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE contracts ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE contracts ADD COLUMN deleted_at TEXT;
ALTER TABLE contracts ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE crafting_blueprint_reward_pools ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE crafting_blueprint_reward_pools ADD COLUMN deleted_at TEXT;
ALTER TABLE crafting_blueprint_reward_pools ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE crafting_blueprints ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE crafting_blueprints ADD COLUMN deleted_at TEXT;
ALTER TABLE crafting_blueprints ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE crafting_resources ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE crafting_resources ADD COLUMN deleted_at TEXT;
ALTER TABLE crafting_resources ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE damage_types ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE damage_types ADD COLUMN deleted_at TEXT;
ALTER TABLE damage_types ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE faction_reputation_scopes ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE faction_reputation_scopes ADD COLUMN deleted_at TEXT;
ALTER TABLE faction_reputation_scopes ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE factions ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE factions ADD COLUMN deleted_at TEXT;
ALTER TABLE factions ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE fps_ammo ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE fps_ammo ADD COLUMN deleted_at TEXT;
ALTER TABLE fps_ammo ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE fps_ammo_types ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE fps_ammo_types ADD COLUMN deleted_at TEXT;
ALTER TABLE fps_ammo_types ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE fps_armour ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE fps_armour ADD COLUMN deleted_at TEXT;
ALTER TABLE fps_armour ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE fps_attachments ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE fps_attachments ADD COLUMN deleted_at TEXT;
ALTER TABLE fps_attachments ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE fps_carryables ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE fps_carryables ADD COLUMN deleted_at TEXT;
ALTER TABLE fps_carryables ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE fps_clothing ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE fps_clothing ADD COLUMN deleted_at TEXT;
ALTER TABLE fps_clothing ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE fps_helmets ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE fps_helmets ADD COLUMN deleted_at TEXT;
ALTER TABLE fps_helmets ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE fps_melee ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE fps_melee ADD COLUMN deleted_at TEXT;
ALTER TABLE fps_melee ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE fps_utilities ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE fps_utilities ADD COLUMN deleted_at TEXT;
ALTER TABLE fps_utilities ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE fps_weapons ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE fps_weapons ADD COLUMN deleted_at TEXT;
ALTER TABLE fps_weapons ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE harvestables ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE harvestables ADD COLUMN deleted_at TEXT;
ALTER TABLE harvestables ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE jurisdiction_infraction_overrides ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE jurisdiction_infraction_overrides ADD COLUMN deleted_at TEXT;
ALTER TABLE jurisdiction_infraction_overrides ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE law_infractions ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE law_infractions ADD COLUMN deleted_at TEXT;
ALTER TABLE law_infractions ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE law_jurisdictions ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE law_jurisdictions ADD COLUMN deleted_at TEXT;
ALTER TABLE law_jurisdictions ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE loot_item_locations ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE loot_item_locations ADD COLUMN deleted_at TEXT;
ALTER TABLE loot_item_locations ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE loot_map ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE loot_map ADD COLUMN deleted_at TEXT;
ALTER TABLE loot_map ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE manufacturers ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE manufacturers ADD COLUMN deleted_at TEXT;
ALTER TABLE manufacturers ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE mineable_elements ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE mineable_elements ADD COLUMN deleted_at TEXT;
ALTER TABLE mineable_elements ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE mining_clustering_presets ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE mining_clustering_presets ADD COLUMN deleted_at TEXT;
ALTER TABLE mining_clustering_presets ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE mining_gadgets ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE mining_gadgets ADD COLUMN deleted_at TEXT;
ALTER TABLE mining_gadgets ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE mining_lasers ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE mining_lasers ADD COLUMN deleted_at TEXT;
ALTER TABLE mining_lasers ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE mining_locations ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE mining_locations ADD COLUMN deleted_at TEXT;
ALTER TABLE mining_locations ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE mining_modules ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE mining_modules ADD COLUMN deleted_at TEXT;
ALTER TABLE mining_modules ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE mining_quality_distributions ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE mining_quality_distributions ADD COLUMN deleted_at TEXT;
ALTER TABLE mining_quality_distributions ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE mission_givers ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE mission_givers ADD COLUMN deleted_at TEXT;
ALTER TABLE mission_givers ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE mission_organizations ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE mission_organizations ADD COLUMN deleted_at TEXT;
ALTER TABLE mission_organizations ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE mission_prerequisites ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE mission_prerequisites ADD COLUMN deleted_at TEXT;
ALTER TABLE mission_prerequisites ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE mission_reputation_requirements ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE mission_reputation_requirements ADD COLUMN deleted_at TEXT;
ALTER TABLE mission_reputation_requirements ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE mission_types ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE mission_types ADD COLUMN deleted_at TEXT;
ALTER TABLE mission_types ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE missions ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE missions ADD COLUMN deleted_at TEXT;
ALTER TABLE missions ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE npc_loadout_items ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE npc_loadout_items ADD COLUMN deleted_at TEXT;
ALTER TABLE npc_loadout_items ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE npc_loadouts ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE npc_loadouts ADD COLUMN deleted_at TEXT;
ALTER TABLE npc_loadouts ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE paints ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE paints ADD COLUMN deleted_at TEXT;
ALTER TABLE paints ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE props ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE props ADD COLUMN deleted_at TEXT;
ALTER TABLE props ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE refining_processes ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE refining_processes ADD COLUMN deleted_at TEXT;
ALTER TABLE refining_processes ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE reputation_perks ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE reputation_perks ADD COLUMN deleted_at TEXT;
ALTER TABLE reputation_perks ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE reputation_reward_tiers ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE reputation_reward_tiers ADD COLUMN deleted_at TEXT;
ALTER TABLE reputation_reward_tiers ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE reputation_scopes ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE reputation_scopes ADD COLUMN deleted_at TEXT;
ALTER TABLE reputation_scopes ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE reputation_standings ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE reputation_standings ADD COLUMN deleted_at TEXT;
ALTER TABLE reputation_standings ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE rock_compositions ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE rock_compositions ADD COLUMN deleted_at TEXT;
ALTER TABLE rock_compositions ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE salvageable_ships ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE salvageable_ships ADD COLUMN deleted_at TEXT;
ALTER TABLE salvageable_ships ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE ship_missiles ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE ship_missiles ADD COLUMN deleted_at TEXT;
ALTER TABLE ship_missiles ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE shop_franchises ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE shop_franchises ADD COLUMN deleted_at TEXT;
ALTER TABLE shop_franchises ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE shop_locations ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE shop_locations ADD COLUMN deleted_at TEXT;
ALTER TABLE shop_locations ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE shops ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE shops ADD COLUMN deleted_at TEXT;
ALTER TABLE shops ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE star_map_locations ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE star_map_locations ADD COLUMN deleted_at TEXT;
ALTER TABLE star_map_locations ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE star_systems ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE star_systems ADD COLUMN deleted_at TEXT;
ALTER TABLE star_systems ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE terminal_inventory ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE terminal_inventory ADD COLUMN deleted_at TEXT;
ALTER TABLE terminal_inventory ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE terminals ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE terminals ADD COLUMN deleted_at TEXT;
ALTER TABLE terminals ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE trade_commodities ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE trade_commodities ADD COLUMN deleted_at TEXT;
ALTER TABLE trade_commodities ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE vehicle_careers ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE vehicle_careers ADD COLUMN deleted_at TEXT;
ALTER TABLE vehicle_careers ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE vehicle_components ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE vehicle_components ADD COLUMN deleted_at TEXT;
ALTER TABLE vehicle_components ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE vehicle_modules ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE vehicle_modules ADD COLUMN deleted_at TEXT;
ALTER TABLE vehicle_modules ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE vehicle_ports ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE vehicle_ports ADD COLUMN deleted_at TEXT;
ALTER TABLE vehicle_ports ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE vehicle_roles ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE vehicle_roles ADD COLUMN deleted_at TEXT;
ALTER TABLE vehicle_roles ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE vehicle_suit_lockers ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE vehicle_suit_lockers ADD COLUMN deleted_at TEXT;
ALTER TABLE vehicle_suit_lockers ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE vehicle_weapon_racks ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE vehicle_weapon_racks ADD COLUMN deleted_at TEXT;
ALTER TABLE vehicle_weapon_racks ADD COLUMN deleted_in_patch TEXT;

ALTER TABLE vehicles ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN deleted_at TEXT;
ALTER TABLE vehicles ADD COLUMN deleted_in_patch TEXT;

-- ── Vehicle-specific columns ─────────────────────────────────────────

-- short_slug: RSI/player-friendly slug (e.g. "hull-b") for search and RSI matching
-- data_source already exists on vehicles (added in 0178)
ALTER TABLE vehicles ADD COLUMN short_slug TEXT;

-- Backfill data_source based on whether the vehicle has p4k game data
UPDATE vehicles SET data_source = 'p4k' WHERE class_name IS NOT NULL AND class_name != '' AND data_source IS NULL;
UPDATE vehicles SET data_source = 'rsi' WHERE (class_name IS NULL OR class_name = '') AND data_source IS NULL;
