-- Migration 0178: Add v2 pipeline columns to migration schema
-- These columns contain richer data from the v2 extraction pipeline.
-- The pipeline outputs these alongside game_version_id (not replacing it).

-- consumables
ALTER TABLE [consumables] ADD COLUMN [can_loot] INTEGER;
ALTER TABLE [consumables] ADD COLUMN [grade] INTEGER;
ALTER TABLE [consumables] ADD COLUMN [grid_height] INTEGER;
ALTER TABLE [consumables] ADD COLUMN [grid_width] INTEGER;
ALTER TABLE [consumables] ADD COLUMN [inventory_volume] REAL;
ALTER TABLE [consumables] ADD COLUMN [loot_rarity] TEXT;
ALTER TABLE [consumables] ADD COLUMN [manufacturer_code] TEXT;
ALTER TABLE [consumables] ADD COLUMN [size] INTEGER;

-- contracts
ALTER TABLE [contracts] ADD COLUMN [name] TEXT;
ALTER TABLE [contracts] ADD COLUMN [slug] TEXT;
ALTER TABLE [contracts] ADD COLUMN [uuid] TEXT;

-- crafting_blueprint_reward_pool_items
ALTER TABLE [crafting_blueprint_reward_pool_items] ADD COLUMN [blueprint_uuid] TEXT;
ALTER TABLE [crafting_blueprint_reward_pool_items] ADD COLUMN [pool_key] TEXT;

-- crafting_blueprint_slots
ALTER TABLE [crafting_blueprint_slots] ADD COLUMN [blueprint_uuid] TEXT;
ALTER TABLE [crafting_blueprint_slots] ADD COLUMN [slot_name] TEXT;

-- crafting_blueprints
ALTER TABLE [crafting_blueprints] ADD COLUMN [description] TEXT;
ALTER TABLE [crafting_blueprints] ADD COLUMN [output_item] TEXT;
ALTER TABLE [crafting_blueprints] ADD COLUMN [slug] TEXT;

-- crafting_resources
ALTER TABLE [crafting_resources] ADD COLUMN [key] TEXT;

-- crafting_slot_modifiers
ALTER TABLE [crafting_slot_modifiers] ADD COLUMN [blueprint_uuid] TEXT;
ALTER TABLE [crafting_slot_modifiers] ADD COLUMN [property_id] TEXT;
ALTER TABLE [crafting_slot_modifiers] ADD COLUMN [slot_index] INTEGER;

-- fps_ammo_types
ALTER TABLE [fps_ammo_types] ADD COLUMN [ammo_type] TEXT;
ALTER TABLE [fps_ammo_types] ADD COLUMN [damage_distortion] REAL;
ALTER TABLE [fps_ammo_types] ADD COLUMN [damage_energy] REAL;
ALTER TABLE [fps_ammo_types] ADD COLUMN [damage_physical] REAL;
ALTER TABLE [fps_ammo_types] ADD COLUMN [speed] REAL;

-- fps_armour
ALTER TABLE [fps_armour] ADD COLUMN [can_loot] INTEGER;
ALTER TABLE [fps_armour] ADD COLUMN [grid_height] INTEGER;
ALTER TABLE [fps_armour] ADD COLUMN [grid_width] INTEGER;
ALTER TABLE [fps_armour] ADD COLUMN [inventory_volume] REAL;
ALTER TABLE [fps_armour] ADD COLUMN [loot_rarity] TEXT;
ALTER TABLE [fps_armour] ADD COLUMN [manufacturer_code] TEXT;
ALTER TABLE [fps_armour] ADD COLUMN [radiation_capacity] REAL;
ALTER TABLE [fps_armour] ADD COLUMN [radiation_dissipation] REAL;
ALTER TABLE [fps_armour] ADD COLUMN [temperature_max] REAL;
ALTER TABLE [fps_armour] ADD COLUMN [temperature_min] REAL;

-- fps_attachments
ALTER TABLE [fps_attachments] ADD COLUMN [can_loot] INTEGER;
ALTER TABLE [fps_attachments] ADD COLUMN [grade] INTEGER;
ALTER TABLE [fps_attachments] ADD COLUMN [grid_height] INTEGER;
ALTER TABLE [fps_attachments] ADD COLUMN [grid_width] INTEGER;
ALTER TABLE [fps_attachments] ADD COLUMN [inventory_volume] REAL;
ALTER TABLE [fps_attachments] ADD COLUMN [loot_rarity] TEXT;
ALTER TABLE [fps_attachments] ADD COLUMN [magazine_capacity] INTEGER;
ALTER TABLE [fps_attachments] ADD COLUMN [magazine_restock_count] INTEGER;
ALTER TABLE [fps_attachments] ADD COLUMN [manufacturer_code] TEXT;

-- fps_carryables
ALTER TABLE [fps_carryables] ADD COLUMN [can_loot] INTEGER;
ALTER TABLE [fps_carryables] ADD COLUMN [grade] INTEGER;
ALTER TABLE [fps_carryables] ADD COLUMN [grid_height] INTEGER;
ALTER TABLE [fps_carryables] ADD COLUMN [grid_width] INTEGER;
ALTER TABLE [fps_carryables] ADD COLUMN [inventory_volume] REAL;
ALTER TABLE [fps_carryables] ADD COLUMN [loot_rarity] TEXT;
ALTER TABLE [fps_carryables] ADD COLUMN [manufacturer_code] TEXT;
ALTER TABLE [fps_carryables] ADD COLUMN [size] INTEGER;

-- fps_clothing
ALTER TABLE [fps_clothing] ADD COLUMN [can_loot] INTEGER;
ALTER TABLE [fps_clothing] ADD COLUMN [grid_height] INTEGER;
ALTER TABLE [fps_clothing] ADD COLUMN [grid_width] INTEGER;
ALTER TABLE [fps_clothing] ADD COLUMN [inventory_volume] REAL;
ALTER TABLE [fps_clothing] ADD COLUMN [item_port_count] INTEGER;
ALTER TABLE [fps_clothing] ADD COLUMN [loot_rarity] TEXT;
ALTER TABLE [fps_clothing] ADD COLUMN [manufacturer_code] TEXT;
ALTER TABLE [fps_clothing] ADD COLUMN [radiation_capacity] REAL;
ALTER TABLE [fps_clothing] ADD COLUMN [radiation_dissipation] REAL;
ALTER TABLE [fps_clothing] ADD COLUMN [temperature_max] REAL;
ALTER TABLE [fps_clothing] ADD COLUMN [temperature_min] REAL;

-- fps_helmets
ALTER TABLE [fps_helmets] ADD COLUMN [can_loot] INTEGER;
ALTER TABLE [fps_helmets] ADD COLUMN [grid_height] INTEGER;
ALTER TABLE [fps_helmets] ADD COLUMN [grid_width] INTEGER;
ALTER TABLE [fps_helmets] ADD COLUMN [has_visor_display] INTEGER;
ALTER TABLE [fps_helmets] ADD COLUMN [inventory_volume] REAL;
ALTER TABLE [fps_helmets] ADD COLUMN [loot_rarity] TEXT;
ALTER TABLE [fps_helmets] ADD COLUMN [manufacturer_code] TEXT;
ALTER TABLE [fps_helmets] ADD COLUMN [max_fov] REAL;
ALTER TABLE [fps_helmets] ADD COLUMN [min_fov] REAL;
ALTER TABLE [fps_helmets] ADD COLUMN [radiation_capacity] REAL;
ALTER TABLE [fps_helmets] ADD COLUMN [radiation_dissipation] REAL;
ALTER TABLE [fps_helmets] ADD COLUMN [temperature_max] REAL;
ALTER TABLE [fps_helmets] ADD COLUMN [temperature_min] REAL;

-- fps_melee
ALTER TABLE [fps_melee] ADD COLUMN [can_loot] INTEGER;
ALTER TABLE [fps_melee] ADD COLUMN [grade] INTEGER;
ALTER TABLE [fps_melee] ADD COLUMN [grid_height] INTEGER;
ALTER TABLE [fps_melee] ADD COLUMN [grid_width] INTEGER;
ALTER TABLE [fps_melee] ADD COLUMN [inventory_volume] REAL;
ALTER TABLE [fps_melee] ADD COLUMN [loot_rarity] TEXT;
ALTER TABLE [fps_melee] ADD COLUMN [manufacturer_code] TEXT;

-- fps_utilities
ALTER TABLE [fps_utilities] ADD COLUMN [can_loot] INTEGER;
ALTER TABLE [fps_utilities] ADD COLUMN [grade] TEXT;
ALTER TABLE [fps_utilities] ADD COLUMN [grid_height] INTEGER;
ALTER TABLE [fps_utilities] ADD COLUMN [grid_width] INTEGER;
ALTER TABLE [fps_utilities] ADD COLUMN [inventory_volume] REAL;
ALTER TABLE [fps_utilities] ADD COLUMN [loot_rarity] TEXT;
ALTER TABLE [fps_utilities] ADD COLUMN [manufacturer_code] TEXT;
ALTER TABLE [fps_utilities] ADD COLUMN [size] INTEGER;

-- fps_weapons
ALTER TABLE [fps_weapons] ADD COLUMN [can_loot] INTEGER;
ALTER TABLE [fps_weapons] ADD COLUMN [cooling_per_second] REAL;
ALTER TABLE [fps_weapons] ADD COLUMN [grade] INTEGER;
ALTER TABLE [fps_weapons] ADD COLUMN [grid_height] INTEGER;
ALTER TABLE [fps_weapons] ADD COLUMN [grid_width] INTEGER;
ALTER TABLE [fps_weapons] ADD COLUMN [heal_range] REAL;
ALTER TABLE [fps_weapons] ADD COLUMN [heal_rate] REAL;
ALTER TABLE [fps_weapons] ADD COLUMN [heal_sensor_range] REAL;
ALTER TABLE [fps_weapons] ADD COLUMN [inventory_volume] REAL;
ALTER TABLE [fps_weapons] ADD COLUMN [loot_rarity] TEXT;
ALTER TABLE [fps_weapons] ADD COLUMN [manufacturer_code] TEXT;
ALTER TABLE [fps_weapons] ADD COLUMN [mining_throttle_speed] REAL;
ALTER TABLE [fps_weapons] ADD COLUMN [overheat_fix_time] REAL;
ALTER TABLE [fps_weapons] ADD COLUMN [overheat_temperature] REAL;
ALTER TABLE [fps_weapons] ADD COLUMN [projectile_lifetime] REAL;
ALTER TABLE [fps_weapons] ADD COLUMN [time_to_cooling_starts] REAL;
ALTER TABLE [fps_weapons] ADD COLUMN [tool_type] TEXT;

-- invitation
ALTER TABLE [invitation] ADD COLUMN [status] TEXT;

-- law_infractions
ALTER TABLE [law_infractions] ADD COLUMN [cool_off_seconds] REAL;
ALTER TABLE [law_infractions] ADD COLUMN [escalation_multiplier] REAL;
ALTER TABLE [law_infractions] ADD COLUMN [fine_amount] REAL;
ALTER TABLE [law_infractions] ADD COLUMN [lifetime_hours] REAL;

-- loot_item_locations
ALTER TABLE [loot_item_locations] ADD COLUMN [item_uuid] TEXT;
ALTER TABLE [loot_item_locations] ADD COLUMN [location_label] TEXT;
ALTER TABLE [loot_item_locations] ADD COLUMN [reward_amount] REAL;
ALTER TABLE [loot_item_locations] ADD COLUMN [reward_max] REAL;

-- loot_map
ALTER TABLE [loot_map] ADD COLUMN [loot_rarity] TEXT;
ALTER TABLE [loot_map] ADD COLUMN [slug] TEXT;

-- mineable_elements
ALTER TABLE [mineable_elements] ADD COLUMN [optimal_midpoint] REAL;
ALTER TABLE [mineable_elements] ADD COLUMN [resource_type] TEXT;

-- mining_clustering_presets
ALTER TABLE [mining_clustering_presets] ADD COLUMN [params] TEXT;

-- mining_locations
ALTER TABLE [mining_locations] ADD COLUMN [deposits] TEXT;

-- mission_types
ALTER TABLE [mission_types] ADD COLUMN [icon_name] TEXT;
ALTER TABLE [mission_types] ADD COLUMN [svg_icon_path] TEXT;

-- missions
ALTER TABLE [missions] ADD COLUMN [lawful] INTEGER;
ALTER TABLE [missions] ADD COLUMN [mission_giver] TEXT;
ALTER TABLE [missions] ADD COLUMN [mission_type] TEXT;
ALTER TABLE [missions] ADD COLUMN [name] TEXT;
ALTER TABLE [missions] ADD COLUMN [reward_min] INTEGER;
ALTER TABLE [missions] ADD COLUMN [slug] TEXT;

-- npc_factions
ALTER TABLE [npc_factions] ADD COLUMN [key] TEXT;
ALTER TABLE [npc_factions] ADD COLUMN [slug] TEXT;

-- npc_loadout_items
ALTER TABLE [npc_loadout_items] ADD COLUMN [item_uuid] TEXT;
ALTER TABLE [npc_loadout_items] ADD COLUMN [loadout_uuid] TEXT;
ALTER TABLE [npc_loadout_items] ADD COLUMN [slot] TEXT;

-- npc_loadouts
ALTER TABLE [npc_loadouts] ADD COLUMN [faction] TEXT;
ALTER TABLE [npc_loadouts] ADD COLUMN [item_count] INTEGER;
ALTER TABLE [npc_loadouts] ADD COLUMN [name] TEXT;
ALTER TABLE [npc_loadouts] ADD COLUMN [species] TEXT;
ALTER TABLE [npc_loadouts] ADD COLUMN [uuid] TEXT;

-- paint_vehicles
ALTER TABLE [paint_vehicles] ADD COLUMN [id] INTEGER;
ALTER TABLE [paint_vehicles] ADD COLUMN [paint_uuid] TEXT;
ALTER TABLE [paint_vehicles] ADD COLUMN [vehicle_class_name] TEXT;

-- paints
ALTER TABLE [paints] ADD COLUMN [can_loot] INTEGER;
ALTER TABLE [paints] ADD COLUMN [grade] INTEGER;
ALTER TABLE [paints] ADD COLUMN [grid_height] INTEGER;
ALTER TABLE [paints] ADD COLUMN [grid_width] INTEGER;
ALTER TABLE [paints] ADD COLUMN [inventory_volume] REAL;
ALTER TABLE [paints] ADD COLUMN [loot_rarity] TEXT;
ALTER TABLE [paints] ADD COLUMN [manufacturer_code] TEXT;
ALTER TABLE [paints] ADD COLUMN [size] INTEGER;
ALTER TABLE [paints] ADD COLUMN [sub_type] TEXT;

-- props
ALTER TABLE [props] ADD COLUMN [manufacturer_code] TEXT;

-- reputation_standings
ALTER TABLE [reputation_standings] ADD COLUMN [description] TEXT;

-- salvageable_ships
ALTER TABLE [salvageable_ships] ADD COLUMN [base_class_name] TEXT;
ALTER TABLE [salvageable_ships] ADD COLUMN [uuid] TEXT;

-- session
ALTER TABLE [session] ADD COLUMN [activeOrganizationId] TEXT;

-- ship_missiles
ALTER TABLE [ship_missiles] ADD COLUMN [manufacturer_code] TEXT;

-- star_map_locations
ALTER TABLE [star_map_locations] ADD COLUMN [affiliation] TEXT;

-- trade_commodities
ALTER TABLE [trade_commodities] ADD COLUMN [sub_category] TEXT;

-- user_pledge_upgrades
ALTER TABLE [user_pledge_upgrades] ADD COLUMN [name] TEXT;
ALTER TABLE [user_pledge_upgrades] ADD COLUMN [rsi_pledge_id] INTEGER;
ALTER TABLE [user_pledge_upgrades] ADD COLUMN [synced_at] TEXT;

-- vehicle_components
ALTER TABLE [vehicle_components] ADD COLUMN [can_loot] INTEGER;
ALTER TABLE [vehicle_components] ADD COLUMN [capacity] REAL;
ALTER TABLE [vehicle_components] ADD COLUMN [charge_time] REAL;
ALTER TABLE [vehicle_components] ADD COLUMN [decay_ratio] REAL;
ALTER TABLE [vehicle_components] ADD COLUMN [grid_height] INTEGER;
ALTER TABLE [vehicle_components] ADD COLUMN [grid_width] INTEGER;
ALTER TABLE [vehicle_components] ADD COLUMN [interdiction_effect_time] REAL;
ALTER TABLE [vehicle_components] ADD COLUMN [inventory_volume] REAL;
ALTER TABLE [vehicle_components] ADD COLUMN [loot_rarity] TEXT;
ALTER TABLE [vehicle_components] ADD COLUMN [manufacturer_code] TEXT;
ALTER TABLE [vehicle_components] ADD COLUMN [max_calibration_requirement] REAL;
ALTER TABLE [vehicle_components] ADD COLUMN [min_calibration_requirement] REAL;
ALTER TABLE [vehicle_components] ADD COLUMN [mining_throttle_speed] REAL;

-- vehicle_images
ALTER TABLE [vehicle_images] ADD COLUMN [rsi_cdn_new] TEXT;
ALTER TABLE [vehicle_images] ADD COLUMN [rsi_cdn_old] TEXT;
ALTER TABLE [vehicle_images] ADD COLUMN [rsi_graphql] TEXT;
ALTER TABLE [vehicle_images] ADD COLUMN [rsi_id] INTEGER;
ALTER TABLE [vehicle_images] ADD COLUMN [rsi_slug] TEXT;

-- vehicle_ports
ALTER TABLE [vehicle_ports] ADD COLUMN [max_size] INTEGER;
ALTER TABLE [vehicle_ports] ADD COLUMN [min_size] INTEGER;
ALTER TABLE [vehicle_ports] ADD COLUMN [parent_port_name] TEXT;
ALTER TABLE [vehicle_ports] ADD COLUMN [port_name] TEXT;
ALTER TABLE [vehicle_ports] ADD COLUMN [vehicle_name] TEXT;
ALTER TABLE [vehicle_ports] ADD COLUMN [vehicle_uuid] TEXT;

-- vehicle_suit_lockers
ALTER TABLE [vehicle_suit_lockers] ADD COLUMN [entity_name] TEXT;
ALTER TABLE [vehicle_suit_lockers] ADD COLUMN [max_size] INTEGER;
ALTER TABLE [vehicle_suit_lockers] ADD COLUMN [min_size] INTEGER;
ALTER TABLE [vehicle_suit_lockers] ADD COLUMN [port_name] TEXT;
ALTER TABLE [vehicle_suit_lockers] ADD COLUMN [vehicle_name] TEXT;

-- vehicle_weapon_racks
ALTER TABLE [vehicle_weapon_racks] ADD COLUMN [entity_name] TEXT;
ALTER TABLE [vehicle_weapon_racks] ADD COLUMN [port_name] TEXT;
ALTER TABLE [vehicle_weapon_racks] ADD COLUMN [rack_type] TEXT;
ALTER TABLE [vehicle_weapon_racks] ADD COLUMN [vehicle_name] TEXT;

-- vehicles
ALTER TABLE [vehicles] ADD COLUMN [manufacturer_code] TEXT;
ALTER TABLE [vehicles] ADD COLUMN [vehicle_type] TEXT;

-- data_source column on all versioned tables
ALTER TABLE [armor_resistance_profiles] ADD COLUMN data_source TEXT;
ALTER TABLE [commodities] ADD COLUMN data_source TEXT;
ALTER TABLE [consumable_effect_types] ADD COLUMN data_source TEXT;
ALTER TABLE [consumable_effects] ADD COLUMN data_source TEXT;
ALTER TABLE [consumables] ADD COLUMN data_source TEXT;
ALTER TABLE [contract_blueprint_reward_pools] ADD COLUMN data_source TEXT;
ALTER TABLE [contract_generator_blueprint_pools] ADD COLUMN data_source TEXT;
ALTER TABLE [contract_generator_careers] ADD COLUMN data_source TEXT;
ALTER TABLE [contract_generator_contracts] ADD COLUMN data_source TEXT;
ALTER TABLE [contract_generators] ADD COLUMN data_source TEXT;
ALTER TABLE [contracts] ADD COLUMN data_source TEXT;
ALTER TABLE [crafting_blueprint_reward_pools] ADD COLUMN data_source TEXT;
ALTER TABLE [crafting_blueprints] ADD COLUMN data_source TEXT;
ALTER TABLE [crafting_resources] ADD COLUMN data_source TEXT;
ALTER TABLE [damage_types] ADD COLUMN data_source TEXT;
ALTER TABLE [faction_reputation_scopes] ADD COLUMN data_source TEXT;
ALTER TABLE [factions] ADD COLUMN data_source TEXT;
ALTER TABLE [fps_ammo] ADD COLUMN data_source TEXT;
ALTER TABLE [fps_ammo_types] ADD COLUMN data_source TEXT;
ALTER TABLE [fps_armour] ADD COLUMN data_source TEXT;
ALTER TABLE [fps_attachments] ADD COLUMN data_source TEXT;
ALTER TABLE [fps_carryables] ADD COLUMN data_source TEXT;
ALTER TABLE [fps_clothing] ADD COLUMN data_source TEXT;
ALTER TABLE [fps_helmets] ADD COLUMN data_source TEXT;
ALTER TABLE [fps_melee] ADD COLUMN data_source TEXT;
ALTER TABLE [fps_utilities] ADD COLUMN data_source TEXT;
ALTER TABLE [fps_weapons] ADD COLUMN data_source TEXT;
ALTER TABLE [harvestables] ADD COLUMN data_source TEXT;
ALTER TABLE [jurisdiction_infraction_overrides] ADD COLUMN data_source TEXT;
ALTER TABLE [law_infractions] ADD COLUMN data_source TEXT;
ALTER TABLE [law_jurisdictions] ADD COLUMN data_source TEXT;
ALTER TABLE [loot_item_locations] ADD COLUMN data_source TEXT;
ALTER TABLE [loot_map] ADD COLUMN data_source TEXT;
ALTER TABLE [manufacturers] ADD COLUMN data_source TEXT;
ALTER TABLE [mineable_elements] ADD COLUMN data_source TEXT;
ALTER TABLE [mining_clustering_presets] ADD COLUMN data_source TEXT;
ALTER TABLE [mining_gadgets] ADD COLUMN data_source TEXT;
ALTER TABLE [mining_lasers] ADD COLUMN data_source TEXT;
ALTER TABLE [mining_locations] ADD COLUMN data_source TEXT;
ALTER TABLE [mining_modules] ADD COLUMN data_source TEXT;
ALTER TABLE [mining_quality_distributions] ADD COLUMN data_source TEXT;
ALTER TABLE [mission_givers] ADD COLUMN data_source TEXT;
ALTER TABLE [mission_organizations] ADD COLUMN data_source TEXT;
ALTER TABLE [mission_prerequisites] ADD COLUMN data_source TEXT;
ALTER TABLE [mission_reputation_requirements] ADD COLUMN data_source TEXT;
ALTER TABLE [mission_types] ADD COLUMN data_source TEXT;
ALTER TABLE [missions] ADD COLUMN data_source TEXT;
ALTER TABLE [npc_loadout_items] ADD COLUMN data_source TEXT;
ALTER TABLE [npc_loadouts] ADD COLUMN data_source TEXT;
ALTER TABLE [paints] ADD COLUMN data_source TEXT;
ALTER TABLE [props] ADD COLUMN data_source TEXT;
ALTER TABLE [refining_processes] ADD COLUMN data_source TEXT;
ALTER TABLE [reputation_perks] ADD COLUMN data_source TEXT;
ALTER TABLE [reputation_reward_tiers] ADD COLUMN data_source TEXT;
ALTER TABLE [reputation_scopes] ADD COLUMN data_source TEXT;
ALTER TABLE [reputation_standings] ADD COLUMN data_source TEXT;
ALTER TABLE [rock_compositions] ADD COLUMN data_source TEXT;
ALTER TABLE [salvageable_ships] ADD COLUMN data_source TEXT;
ALTER TABLE [ship_missiles] ADD COLUMN data_source TEXT;
ALTER TABLE [shop_franchises] ADD COLUMN data_source TEXT;
ALTER TABLE [shop_inventory] ADD COLUMN data_source TEXT;
ALTER TABLE [shop_locations] ADD COLUMN data_source TEXT;
ALTER TABLE [shops] ADD COLUMN data_source TEXT;
ALTER TABLE [star_map_locations] ADD COLUMN data_source TEXT;
ALTER TABLE [star_systems] ADD COLUMN data_source TEXT;
ALTER TABLE [trade_commodities] ADD COLUMN data_source TEXT;
ALTER TABLE [vehicle_careers] ADD COLUMN data_source TEXT;
ALTER TABLE [vehicle_components] ADD COLUMN data_source TEXT;
ALTER TABLE [vehicle_modules] ADD COLUMN data_source TEXT;
ALTER TABLE [vehicle_ports] ADD COLUMN data_source TEXT;
ALTER TABLE [vehicle_roles] ADD COLUMN data_source TEXT;
ALTER TABLE [vehicle_suit_lockers] ADD COLUMN data_source TEXT;
ALTER TABLE [vehicle_weapon_racks] ADD COLUMN data_source TEXT;
ALTER TABLE [vehicles] ADD COLUMN data_source TEXT;
