/**
 * PTU shadow table infrastructure.
 *
 * PTU data lives in `ptu_*` prefix tables in the same DB as live data.
 * Hard purge on PTU end = DROP TABLE IF EXISTS ptu_*.
 * Query routing: isPTU ? `ptu_vehicles` : `vehicles`.
 */

/**
 * All 86 versioned game-data tables, in FK-safe deletion order
 * (children before parents). Used for PTU table creation and purge.
 */
export const VERSIONED_TABLES = [
  // Vehicle children → vehicles → manufacturers
  "vehicle_weapon_racks", "vehicle_suit_lockers", "vehicle_ports",
  "vehicle_modules", "vehicle_roles", "vehicle_careers",
  "salvageable_ships",
  // Loot children → loot_map → FPS/vehicle tables
  "loot_item_locations", "loot_map",
  "vehicle_components",
  // Component subtables
  "component_coolers", "component_mining", "component_missiles",
  "component_powerplants", "component_qed", "component_quantum_drives",
  "component_radar", "component_shields", "component_thrusters",
  "component_turrets", "component_weapons",
  // Shop children → shops
  "shop_locations", "shop_franchises",
  "terminal_inventory", "terminals",
  // Mission children → missions → mission_givers
  "mission_prerequisites", "mission_reputation_requirements",
  "missions", "mission_givers", "mission_types", "mission_organizations",
  "star_map_locations", "star_systems",
  "ship_missiles",
  // Reputation children → reputation_scopes → factions
  "reputation_perks", "reputation_standings",
  "faction_reputation_scopes", "reputation_scopes", "reputation_reward_tiers",
  // NPC children
  "npc_loadout_items", "npc_loadouts",
  // Mining
  "rock_compositions", "mining_quality_distributions", "mining_modules",
  "mining_locations", "mining_lasers", "mining_gadgets",
  "mining_clustering_presets", "mineable_elements",
  // FPS tables → manufacturers
  "fps_weapons", "fps_utilities", "fps_melee", "fps_helmets",
  "fps_clothing", "fps_attachments", "fps_armour",
  "fps_ammo_types", "fps_carryables",
  "consumable_effects", "consumable_effect_types", "consumables",
  // Contract system
  "contract_generator_blueprint_pools", "contract_generator_careers",
  "contract_generator_contracts", "contract_generators",
  "contract_blueprint_reward_pools", "contracts",
  // Crafting
  "crafting_blueprint_reward_pools", "crafting_resources", "crafting_blueprints",
  // Reference tables
  "armor_resistance_profiles",
  "jurisdiction_infraction_overrides", "law_jurisdictions", "law_infractions",
  "harvestables", "props",
  "trade_commodities",
  "refining_processes",
  "damage_types", "factions",
  "paints", "shops",
  // Root parents (delete last)
  "vehicles", "manufacturers",
] as const;

/** Returns the table name for the given context (live or PTU). */
export function resolveTable(table: string, isPTU: boolean): string {
  return isPTU ? `ptu_${table}` : table;
}
