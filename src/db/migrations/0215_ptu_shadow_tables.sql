-- 0215_ptu_shadow_tables.sql
-- Mirror tables for PTU/EPTU channel data.
-- Same schema as base tables, but FKs to versioned tables point at ptu_* siblings.
-- FKs to non-versioned tables (e.g., game_versions) keep their original target.
-- Idempotent (IF NOT EXISTS) so admin DROP + next PTU load can re-create cleanly.
-- Indexes on ptu_* tables added below.

CREATE TABLE IF NOT EXISTS ptu_vehicle_weapon_racks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id        INTEGER REFERENCES ptu_vehicles(id),
  rack_entity_name  TEXT NOT NULL,
  uuid              TEXT NOT NULL,
  rack_label        TEXT,
  total_ports       INTEGER NOT NULL DEFAULT 0,
  rifle_ports       INTEGER NOT NULL DEFAULT 0,
  pistol_ports      INTEGER NOT NULL DEFAULT 0,
  heavy_ports       INTEGER NOT NULL DEFAULT 0,
  utility_ports     INTEGER NOT NULL DEFAULT 0,
  min_size          INTEGER,
  max_size          INTEGER,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  removed           INTEGER NOT NULL DEFAULT 0,
  vehicle_name      TEXT,
  entity_name       TEXT,
  port_name         TEXT,
  rack_type         TEXT,
  data_source       TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid, vehicle_id)
);
CREATE TABLE IF NOT EXISTS ptu_vehicle_suit_lockers (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id         INTEGER REFERENCES ptu_vehicles(id),
  locker_entity_name TEXT NOT NULL,
  uuid               TEXT NOT NULL,
  locker_label       TEXT,
  locker_count       INTEGER DEFAULT 1,
  game_version_id    INTEGER NOT NULL REFERENCES game_versions(id),
  removed            INTEGER NOT NULL DEFAULT 0,
  vehicle_name       TEXT,
  data_source        TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT, entity_name TEXT, port_name TEXT, min_size INTEGER, max_size INTEGER,
  UNIQUE(uuid, vehicle_id)
);
CREATE TABLE IF NOT EXISTS ptu_vehicle_ports (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid               TEXT    NOT NULL,
  vehicle_id         INTEGER NOT NULL REFERENCES ptu_vehicles(id),
  parent_port_id     INTEGER REFERENCES ptu_vehicle_ports(id),
  name               TEXT    NOT NULL,
  position           TEXT,
  category_label     TEXT,
  size_min           INTEGER,
  size_max           INTEGER,
  port_type          TEXT,
  port_subtype       TEXT,
  equipped_item_uuid TEXT,
  editable           BOOLEAN DEFAULT TRUE,
  health             REAL,
  game_version_id    INTEGER NOT NULL REFERENCES game_versions(id),
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP, controller TEXT, controller_label TEXT, missile_type TEXT, removed INTEGER NOT NULL DEFAULT 0, [max_size] INTEGER, [min_size] INTEGER, [parent_port_name] TEXT, [port_name] TEXT, [vehicle_name] TEXT, [vehicle_uuid] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_vehicle_modules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  vehicle_id      INTEGER NOT NULL REFERENCES ptu_vehicles(id),
  port_name       TEXT    NOT NULL,
  class_name      TEXT    NOT NULL,
  display_name    TEXT,
  size            INTEGER,
  tags            TEXT,
  is_default      INTEGER NOT NULL DEFAULT 0,
  has_loadout     INTEGER NOT NULL DEFAULT 0,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  created_at      TEXT    DEFAULT (datetime('now')),
  removed         INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid, vehicle_id)
);
CREATE TABLE IF NOT EXISTS ptu_vehicle_roles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  slug            TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id), removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_vehicle_careers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  slug            TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id), removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_salvageable_ships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_name TEXT NOT NULL,
    entity_uuid TEXT NOT NULL,
    base_vehicle_id INTEGER REFERENCES ptu_vehicles(id),
    variant_type TEXT NOT NULL,
    game_version_id INTEGER REFERENCES game_versions(id)
, removed INTEGER NOT NULL DEFAULT 0, [base_class_name] TEXT, [uuid] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT);
CREATE TABLE IF NOT EXISTS ptu_loot_item_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loot_map_id INTEGER NOT NULL REFERENCES ptu_loot_map(id),
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  source_type TEXT NOT NULL CHECK(source_type IN ('container','shop','npc','contract')),
  location_key TEXT NOT NULL,
  
  container_type TEXT,
  per_container REAL,
  per_roll REAL,
  rolls INTEGER,
  loot_table TEXT,
  
  actor TEXT,
  faction TEXT,
  slot TEXT,
  probability REAL,
  
  weight REAL
, spawn_locations TEXT, [item_uuid] TEXT, [location_label] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT);
CREATE TABLE IF NOT EXISTS ptu_loot_map (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                 TEXT    NOT NULL,
  name                 TEXT    NOT NULL,
  class_name           TEXT,
  type                 TEXT,
  sub_type             TEXT,
  rarity               TEXT,
  vehicle_component_id INTEGER REFERENCES ptu_vehicle_components(id),
  fps_weapon_id        INTEGER REFERENCES ptu_fps_weapons(id),
  fps_armour_id        INTEGER REFERENCES ptu_fps_armour(id),
  fps_attachment_id    INTEGER REFERENCES ptu_fps_attachments(id),
  fps_utility_id       INTEGER REFERENCES ptu_fps_utilities(id),
  fps_helmet_id        INTEGER REFERENCES ptu_fps_helmets(id),
  fps_clothing_id      INTEGER REFERENCES ptu_fps_clothing(id),
  consumable_id        INTEGER REFERENCES ptu_consumables(id),
  harvestable_id       INTEGER REFERENCES ptu_harvestables(id),
  props_id             INTEGER REFERENCES ptu_props(id),
  game_version_id      INTEGER NOT NULL REFERENCES game_versions(id),
  updated_at           TEXT    DEFAULT (datetime('now')), ship_missile_id INTEGER REFERENCES ptu_ship_missiles(id), manufacturer_name TEXT, category TEXT, removed INTEGER NOT NULL DEFAULT 0, fps_melee_id INTEGER REFERENCES ptu_fps_melee(id), fps_carryable_id INTEGER REFERENCES ptu_fps_carryables(id), [loot_rarity] TEXT, [slug] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_vehicle_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT,
  class_name TEXT,
  manufacturer_id INTEGER,
  type TEXT NOT NULL,
  sub_type TEXT,
  size INTEGER,
  grade TEXT,
  description TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  raw_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  class TEXT,
  component_class TEXT,
  em_signature REAL,
  mass REAL,
  hp REAL,
  power_draw REAL,
  power_draw_min REAL,
  thermal_output REAL,
  base_heat_generation REAL,
  distortion_max REAL,
  removed INTEGER NOT NULL DEFAULT 0,
  manufacturer_code TEXT,
  can_loot INTEGER,
  loot_rarity TEXT,
  inventory_volume REAL,
  grid_width INTEGER,
  grid_height INTEGER,
  capacity REAL,
  data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_component_coolers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES ptu_vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  cooling_rate REAL,
  max_temperature REAL,
  overheat_temperature REAL, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(component_id)
);
CREATE TABLE IF NOT EXISTS ptu_component_mining (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES ptu_vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  mining_throttle_speed REAL,
  min_calibration_requirement REAL,
  max_calibration_requirement REAL, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(component_id)
);
CREATE TABLE IF NOT EXISTS ptu_component_missiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES ptu_vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  ammo_count INTEGER,
  missile_type TEXT,
  UNIQUE(component_id, game_version_id)
);
CREATE TABLE IF NOT EXISTS ptu_component_powerplants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES ptu_vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  power_output REAL,
  overpower_performance REAL,
  overclock_performance REAL,
  overclock_threshold_min REAL,
  overclock_threshold_max REAL, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT, max_temperature REAL, overheat_temperature REAL,
  UNIQUE(component_id)
);
CREATE TABLE IF NOT EXISTS ptu_component_qed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES ptu_vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  qed_range REAL,
  qed_strength REAL, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(component_id)
);
CREATE TABLE IF NOT EXISTS ptu_component_quantum_drives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES ptu_vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  quantum_speed REAL,
  quantum_range REAL,
  fuel_rate REAL,
  spool_time REAL,
  cooldown_time REAL,
  stage1_accel REAL,
  stage2_accel REAL,
  calibration_rate REAL,
  engage_speed REAL, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(component_id)
);
CREATE TABLE IF NOT EXISTS ptu_component_radar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES ptu_vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  radar_range REAL,
  radar_angle REAL, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(component_id)
);
CREATE TABLE IF NOT EXISTS ptu_component_shields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES ptu_vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  shield_hp REAL,
  shield_regen REAL,
  resist_physical REAL,
  resist_energy REAL,
  resist_distortion REAL,
  resist_thermal REAL,
  regen_delay REAL,
  downed_regen_delay REAL,
  resist_physical_min REAL,
  resist_energy_min REAL,
  resist_distortion_min REAL,
  resist_thermal_min REAL,
  absorb_physical_min REAL,
  absorb_physical_max REAL, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(component_id)
);
CREATE TABLE IF NOT EXISTS ptu_component_thrusters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES ptu_vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  thrust_force REAL,
  fuel_burn_rate REAL, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(component_id)
);
CREATE TABLE IF NOT EXISTS ptu_component_turrets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES ptu_vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  rotation_speed REAL,
  min_pitch REAL,
  max_pitch REAL,
  min_yaw REAL,
  max_yaw REAL,
  gimbal_type TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(component_id)
);
CREATE TABLE IF NOT EXISTS ptu_component_weapons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES ptu_vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  rounds_per_minute REAL,
  ammo_container_size INTEGER,
  damage_per_shot REAL,
  damage_type TEXT,
  projectile_speed REAL,
  effective_range REAL,
  dps REAL,
  heat_per_shot REAL,
  fire_modes TEXT,
  damage_physical REAL,
  damage_energy REAL,
  damage_distortion REAL,
  damage_thermal REAL,
  penetration REAL,
  weapon_range REAL,
  laser_instability REAL,
  optimal_charge_window_size REAL,
  resistance_modifier REAL,
  shatter_damage_modifier REAL,
  optimal_charge_rate REAL,
  catastrophic_charge_rate REAL,
  filter_modifier REAL,
  charge_time REAL,
  decay_ratio REAL,
  interdiction_effect_time REAL, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(component_id)
);
CREATE TABLE IF NOT EXISTS ptu_shop_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES ptu_shops(id),
  location_id INTEGER NOT NULL REFERENCES ptu_star_map_locations(id),
  placement_name TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id), data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(shop_id, location_id)
);
CREATE TABLE IF NOT EXISTS ptu_shop_franchises (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  localization_key  TEXT,
  slug              TEXT,
  game_version_id   INTEGER REFERENCES game_versions(id), data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_terminal_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  terminal_id INTEGER NOT NULL REFERENCES ptu_terminals(id),
  item_uuid TEXT NOT NULL,
  item_type TEXT,
  item_name TEXT,
  base_buy_price REAL,
  base_sell_price REAL,
  latest_buy_price REAL,
  latest_sell_price REAL,
  latest_source TEXT,
  latest_observed_at TEXT,
  base_inventory REAL,
  max_inventory REAL,
  game_version_id INTEGER REFERENCES game_versions(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')), is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(terminal_id, item_uuid)
);
CREATE TABLE IF NOT EXISTS ptu_terminals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  shop_id INTEGER REFERENCES ptu_shops(id),
  shop_name_key TEXT NOT NULL UNIQUE,
  terminal_type TEXT,
  uex_terminal_id INTEGER,
  game_version_id INTEGER REFERENCES game_versions(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT);
CREATE TABLE IF NOT EXISTS ptu_mission_prerequisites (
  mission_id INTEGER NOT NULL REFERENCES ptu_missions(id),
  required_mission_id INTEGER NOT NULL REFERENCES ptu_missions(id),
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id), data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  PRIMARY KEY (mission_id, required_mission_id)
);
CREATE TABLE IF NOT EXISTS ptu_mission_reputation_requirements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id INTEGER NOT NULL REFERENCES ptu_missions(id),
  faction_slug TEXT NOT NULL,
  scope_slug TEXT NOT NULL,
  comparison TEXT NOT NULL,
  standing_slug TEXT NOT NULL,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  data_source TEXT DEFAULT 'p4k',
  is_deleted INTEGER DEFAULT 0,
  deleted_at TEXT,
  deleted_in_patch TEXT,
  UNIQUE(mission_id, faction_slug, scope_slug, comparison, standing_slug, game_version_id)
);
CREATE TABLE IF NOT EXISTS ptu_missions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                  TEXT NOT NULL,
  title                 TEXT,
  display_name          TEXT,
  description           TEXT,
  mission_type_id       INTEGER REFERENCES ptu_mission_types(id),
  mission_giver_id      INTEGER REFERENCES ptu_mission_givers(id),
  reward_amount         INTEGER DEFAULT 0,
  reward_currency       TEXT DEFAULT 'aUEC',
  reputation_scope_id   INTEGER REFERENCES ptu_reputation_scopes(id),
  reputation_reward_size TEXT,
  min_reputation        INTEGER,
  is_lawful             INTEGER,
  not_for_release       INTEGER DEFAULT 0,
  location_hint         TEXT,
  category              TEXT,
  subcategory           TEXT,
  difficulty            TEXT,
  game_version_id       INTEGER NOT NULL REFERENCES game_versions(id), removed INTEGER NOT NULL DEFAULT 0, rep_fail_summary TEXT, rep_abandon_summary TEXT, time_limit_minutes INTEGER, max_players INTEGER, can_share INTEGER DEFAULT 1, once_only INTEGER DEFAULT 0, fail_if_criminal INTEGER, available_in_prison INTEGER DEFAULT 0, wanted_level_min INTEGER DEFAULT 0, wanted_level_max INTEGER DEFAULT 5, buy_in_amount INTEGER DEFAULT 0, reward_max INTEGER, has_standing_bonus INTEGER DEFAULT 0, location_ref TEXT, locality TEXT, [mission_giver] TEXT, [mission_type] TEXT, [name] TEXT, [reward_min] INTEGER, [slug] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT, is_dynamic_reward INTEGER NOT NULL DEFAULT 0,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_mission_givers (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  description       TEXT,
  faction_id        INTEGER REFERENCES ptu_factions(id),
  location_id       INTEGER REFERENCES ptu_star_map_locations(id),
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')), removed INTEGER NOT NULL DEFAULT 0, biography TEXT, occupation TEXT, association TEXT, headquarters TEXT, portrait_url TEXT, is_lawful INTEGER, allies_json TEXT, enemies_json TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_mission_types (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  description       TEXT,
  category          TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')), removed INTEGER NOT NULL DEFAULT 0, [icon_name] TEXT, [svg_icon_path] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_mission_organizations (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  description       TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')), data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_star_map_locations (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                  TEXT    NOT NULL,
  name                  TEXT    NOT NULL,
  slug                  TEXT,
  description           TEXT,
  location_type         TEXT    NOT NULL,
  parent_uuid           TEXT,
  star_system_id        INTEGER REFERENCES ptu_star_systems(id),
  jurisdiction_id       INTEGER REFERENCES ptu_law_jurisdictions(id),
  is_scannable          INTEGER DEFAULT 0,
  hide_in_starmap       INTEGER DEFAULT 0,
  game_version_id       INTEGER NOT NULL REFERENCES game_versions(id),
  created_at            TEXT    DEFAULT (datetime('now')),
  updated_at            TEXT    DEFAULT (datetime('now')), removed INTEGER NOT NULL DEFAULT 0, [affiliation] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_star_systems (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  code              TEXT,
  description       TEXT,
  galactic_x        REAL,
  galactic_y        REAL,
  galactic_z        REAL,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')), removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_ship_missiles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  class_name      TEXT,
  name            TEXT    NOT NULL,
  slug            TEXT,
  description     TEXT,
  type            TEXT,
  sub_type        TEXT,
  size            INTEGER,
  grade           TEXT,
  manufacturer_id INTEGER REFERENCES ptu_manufacturers(id),
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  created_at      TEXT    DEFAULT (datetime('now')),
  updated_at      TEXT    DEFAULT (datetime('now')), missile_type TEXT, lock_time REAL, tracking_signal TEXT, damage REAL, damage_type TEXT, blast_radius REAL, speed REAL, lock_range REAL, ammo_count INTEGER, removed INTEGER NOT NULL DEFAULT 0, [manufacturer_code] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_reputation_perks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  scope_id          INTEGER NOT NULL REFERENCES ptu_reputation_scopes(id),
  standing_id       INTEGER NOT NULL REFERENCES ptu_reputation_standings(id),
  perk_name         TEXT NOT NULL,
  display_name      TEXT,
  description       TEXT,
  reward_item_uuid  TEXT,
  reward_item_name  TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id), removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(scope_id, standing_id, perk_name)
);
CREATE TABLE IF NOT EXISTS ptu_reputation_standings (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  scope_id          INTEGER NOT NULL REFERENCES ptu_reputation_scopes(id),
  min_reputation    INTEGER NOT NULL,
  drift_reputation  INTEGER DEFAULT 0,
  drift_time_hours  REAL    DEFAULT 0,
  is_gated          INTEGER DEFAULT 0,
  perk_description  TEXT,
  sort_order        INTEGER,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')), removed INTEGER NOT NULL DEFAULT 0, [description] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid, scope_id)
);
CREATE TABLE IF NOT EXISTS ptu_faction_reputation_scopes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  faction_id        INTEGER NOT NULL REFERENCES ptu_factions(id),
  reputation_scope_id INTEGER NOT NULL REFERENCES ptu_reputation_scopes(id),
  is_primary        INTEGER DEFAULT 0,
  source            TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')), data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(faction_id, reputation_scope_id)
);
CREATE TABLE IF NOT EXISTS ptu_reputation_scopes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  scope_key         TEXT    NOT NULL,
  description       TEXT,
  faction_id        INTEGER REFERENCES ptu_factions(id),
  max_reputation    INTEGER,
  initial_reputation INTEGER DEFAULT 0,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')), removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_reputation_reward_tiers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  size_code       TEXT NOT NULL,
  direction       TEXT NOT NULL,
  rep_amount      INTEGER NOT NULL,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id), removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(size_code, direction)
);
CREATE TABLE IF NOT EXISTS ptu_npc_loadout_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  loadout_id        INTEGER NOT NULL REFERENCES ptu_npc_loadouts(id) ON DELETE CASCADE,
  port_name         TEXT NOT NULL,
  item_name         TEXT NOT NULL,
  tag               TEXT,
  parent_port       TEXT,
  loot_map_uuid     TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id)
, is_hidden INTEGER DEFAULT 0, resolved_name TEXT, loot_item_id INTEGER, manufacturer_name TEXT, [item_uuid] TEXT, [loadout_uuid] TEXT, [slot] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT);
CREATE TABLE IF NOT EXISTS ptu_npc_loadouts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path         TEXT NOT NULL,
  loadout_name      TEXT NOT NULL,
  faction_id        INTEGER REFERENCES npc_factions(id),
  category          TEXT NOT NULL,
  sub_category      TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT DEFAULT (datetime('now')), visible_item_count INTEGER DEFAULT 0, removed INTEGER NOT NULL DEFAULT 0, [faction] TEXT, [item_count] INTEGER, [name] TEXT, [species] TEXT, [uuid] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(file_path)
);
CREATE TABLE IF NOT EXISTS ptu_rock_compositions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  class_name        TEXT,
  rock_type         TEXT,
  min_elements      INTEGER,
  composition_json  TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')), removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_mining_quality_distributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    min_quality INTEGER NOT NULL DEFAULT 1,
    max_quality INTEGER NOT NULL DEFAULT 1000,
    mean REAL NOT NULL DEFAULT 500,
    stddev REAL NOT NULL DEFAULT 250,
    game_version_id INTEGER REFERENCES game_versions(id)
, removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT);
CREATE TABLE IF NOT EXISTS ptu_mining_modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 1,
    grade INTEGER NOT NULL DEFAULT 1,
    manufacturer TEXT,
    charges INTEGER,
    lifetime REAL,
    damage_multiplier REAL NOT NULL DEFAULT 1.0,
    mod_instability REAL NOT NULL DEFAULT 0,
    mod_optimal_window_size REAL NOT NULL DEFAULT 0,
    mod_resistance REAL NOT NULL DEFAULT 0,
    mod_shatter_damage REAL NOT NULL DEFAULT 0,
    mod_cluster_factor REAL NOT NULL DEFAULT 0,
    mod_optimal_charge_rate REAL NOT NULL DEFAULT 0,
    mod_catastrophic_charge_rate REAL NOT NULL DEFAULT 0,
    mod_filter REAL NOT NULL DEFAULT 0,
    game_version_id INTEGER REFERENCES game_versions(id)
, removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT);
CREATE TABLE IF NOT EXISTS ptu_mining_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preset_file TEXT NOT NULL,
    preset_guid TEXT,
    name TEXT NOT NULL,
    system TEXT NOT NULL,
    location_type TEXT NOT NULL,
    game_version_id INTEGER REFERENCES game_versions(id)
, removed INTEGER NOT NULL DEFAULT 0, [deposits] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT);
CREATE TABLE IF NOT EXISTS ptu_mining_lasers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 1,
    grade INTEGER NOT NULL DEFAULT 1,
    manufacturer TEXT,
    vehicle_built_in TEXT,
    module_slots INTEGER NOT NULL DEFAULT 0,
    throttle_lerp_speed REAL,
    throttle_minimum REAL,
    beam_full_range REAL,
    beam_zero_range REAL,
    beam_dps REAL,
    extract_full_range REAL,
    extract_zero_range REAL,
    extract_dps REAL,
    mod_instability REAL NOT NULL DEFAULT 0,
    mod_optimal_window_size REAL NOT NULL DEFAULT 0,
    mod_resistance REAL NOT NULL DEFAULT 0,
    mod_shatter_damage REAL NOT NULL DEFAULT 0,
    mod_cluster_factor REAL NOT NULL DEFAULT 0,
    mod_optimal_charge_rate REAL NOT NULL DEFAULT 0,
    mod_catastrophic_charge_rate REAL NOT NULL DEFAULT 0,
    mod_filter REAL NOT NULL DEFAULT 0,
    game_version_id INTEGER REFERENCES game_versions(id)
, removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT);
CREATE TABLE IF NOT EXISTS ptu_mining_gadgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    manufacturer TEXT,
    mod_instability REAL NOT NULL DEFAULT 0,
    mod_optimal_window_size REAL NOT NULL DEFAULT 0,
    mod_resistance REAL NOT NULL DEFAULT 0,
    mod_shatter_damage REAL NOT NULL DEFAULT 0,
    mod_cluster_factor REAL NOT NULL DEFAULT 0,
    mod_optimal_charge_rate REAL NOT NULL DEFAULT 0,
    mod_catastrophic_charge_rate REAL NOT NULL DEFAULT 0,
    game_version_id INTEGER REFERENCES game_versions(id)
, removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT);
CREATE TABLE IF NOT EXISTS ptu_mining_clustering_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL,
    name TEXT NOT NULL,
    probability_of_clustering REAL NOT NULL DEFAULT 0,
    game_version_id INTEGER REFERENCES game_versions(id), removed INTEGER NOT NULL DEFAULT 0, [params] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
    UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_mineable_elements (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  class_name        TEXT,
  category          TEXT,
  commodity_id      INTEGER REFERENCES commodities(id),
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')), instability REAL, resistance REAL, optimal_window_midpoint REAL, optimal_window_randomness REAL, optimal_window_thinness REAL, explosion_multiplier REAL, cluster_factor REAL, removed INTEGER NOT NULL DEFAULT 0, [optimal_midpoint] REAL, [resource_type] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_fps_weapons (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  slug            TEXT,
  class_name      TEXT,
  manufacturer_id INTEGER REFERENCES ptu_manufacturers(id),
  sub_type        TEXT,
  size            INTEGER,
  description     TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  raw_data        TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP, rounds_per_minute REAL, fire_modes TEXT, burst_count INTEGER, ammo_capacity INTEGER, zoom_factor REAL, item_port_count INTEGER, damage REAL, damage_type TEXT, projectile_speed REAL, effective_range REAL, dps REAL, magazine_uuid TEXT, spread_min REAL, spread_max REAL, removed INTEGER NOT NULL DEFAULT 0, heat_per_shot REAL, charge_time REAL, recoil_strength REAL, weapon_class TEXT, [can_loot] INTEGER, [cooling_per_second] REAL, [grade] INTEGER, [grid_height] INTEGER, [grid_width] INTEGER, [heal_range] REAL, [heal_rate] REAL, [heal_sensor_range] REAL, [inventory_volume] REAL, [loot_rarity] TEXT, [manufacturer_code] TEXT, [mining_throttle_speed] REAL, [overheat_fix_time] REAL, [overheat_temperature] REAL, [projectile_lifetime] REAL, [time_to_cooling_starts] REAL, [tool_type] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT, has_builtin_scope INTEGER NOT NULL DEFAULT 0,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_fps_utilities (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  slug            TEXT,
  class_name      TEXT,
  manufacturer_id INTEGER REFERENCES ptu_manufacturers(id),
  sub_type        TEXT,
  description     TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  raw_data        TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP, heal_amount REAL, effect_duration REAL, consumable_type TEXT, damage REAL, blast_radius REAL, fuse_time REAL, device_type TEXT, removed INTEGER NOT NULL DEFAULT 0, detonation_type TEXT, [can_loot] INTEGER, [grade] TEXT, [grid_height] INTEGER, [grid_width] INTEGER, [inventory_volume] REAL, [loot_rarity] TEXT, [manufacturer_code] TEXT, [size] INTEGER, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_fps_melee (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT NOT NULL,
  name              TEXT NOT NULL,
  display_name      TEXT,
  slug              TEXT,
  class_name        TEXT,
  manufacturer_id   INTEGER REFERENCES ptu_manufacturers(id),
  sub_type          TEXT,
  size              INTEGER,
  description       TEXT,
  damage            REAL,
  damage_type       TEXT,
  attack_speed      REAL,
  range             REAL,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now')), heavy_damage REAL, attack_types REAL, can_block INTEGER, can_takedown INTEGER, removed INTEGER NOT NULL DEFAULT 0, [can_loot] INTEGER, [grade] INTEGER, [grid_height] INTEGER, [grid_width] INTEGER, [inventory_volume] REAL, [loot_rarity] TEXT, [manufacturer_code] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_fps_helmets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  class_name      TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  slug            TEXT,
  description     TEXT,
  sub_type        TEXT,
  size            REAL,
  grade           TEXT,
  manufacturer_id INTEGER REFERENCES ptu_manufacturers(id),
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  created_at      TEXT    DEFAULT (datetime('now')),
  updated_at      TEXT    DEFAULT (datetime('now')), resist_physical REAL, resist_energy REAL, resist_distortion REAL, resist_thermal REAL, resist_biochemical REAL, resist_stun REAL, ir_emission REAL, em_emission REAL, item_port_count INTEGER, atmosphere_capacity REAL, removed INTEGER NOT NULL DEFAULT 0, [can_loot] INTEGER, [grid_height] INTEGER, [grid_width] INTEGER, [has_visor_display] INTEGER, [inventory_volume] REAL, [loot_rarity] TEXT, [manufacturer_code] TEXT, [max_fov] REAL, [min_fov] REAL, [radiation_capacity] REAL, [radiation_dissipation] REAL, [temperature_max] REAL, [temperature_min] REAL, data_source TEXT, protected_body_parts TEXT, armor_weight TEXT, integrity_threshold REAL, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_fps_clothing (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  class_name      TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  slug            TEXT,
  description     TEXT,
  slot            TEXT,
  size            REAL,
  grade           TEXT,
  manufacturer_id INTEGER REFERENCES ptu_manufacturers(id),
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  created_at      TEXT    DEFAULT (datetime('now')),
  updated_at      TEXT    DEFAULT (datetime('now')), resist_physical REAL, resist_energy REAL, resist_distortion REAL, resist_thermal REAL, resist_biochemical REAL, resist_stun REAL, ir_emission REAL, em_emission REAL, storage_capacity INTEGER, temperature_range_min REAL, temperature_range_max REAL, removed INTEGER NOT NULL DEFAULT 0, sub_type TEXT, [can_loot] INTEGER, [grid_height] INTEGER, [grid_width] INTEGER, [inventory_volume] REAL, [item_port_count] INTEGER, [loot_rarity] TEXT, [manufacturer_code] TEXT, [radiation_capacity] REAL, [radiation_dissipation] REAL, [temperature_max] REAL, [temperature_min] REAL, data_source TEXT, protected_body_parts TEXT, armor_weight TEXT, integrity_threshold REAL, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_fps_attachments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  slug            TEXT,
  class_name      TEXT,
  manufacturer_id INTEGER REFERENCES ptu_manufacturers(id),
  sub_type        TEXT,
  size            INTEGER,
  description     TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  raw_data        TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP, zoom_scale REAL, second_zoom_scale REAL, damage_multiplier REAL, sound_radius_multiplier REAL, scope_type TEXT, zeroing_range REAL, zeroing_increment REAL, auto_zeroing_time REAL, is_low_light INTEGER DEFAULT 0, recoil_decay REAL, recoil_strength REAL, recoil_randomness REAL, spread_min REAL, spread_max REAL, spread_attack_time REAL, spread_decay_time REAL, light_type TEXT, light_color TEXT, light_intensity REAL, light_radius REAL, light_fov REAL, removed INTEGER NOT NULL DEFAULT 0, [can_loot] INTEGER, [grade] INTEGER, [grid_height] INTEGER, [grid_width] INTEGER, [inventory_volume] REAL, [loot_rarity] TEXT, [magazine_capacity] INTEGER, [magazine_restock_count] INTEGER, [manufacturer_code] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT, fire_rate_multiplier REAL, projectile_speed_multiplier REAL, heat_generation_multiplier REAL,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_fps_armour (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  slug            TEXT,
  class_name      TEXT,
  manufacturer_id INTEGER REFERENCES ptu_manufacturers(id),
  sub_type        TEXT,
  size            INTEGER,
  grade           TEXT,
  description     TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  raw_data        TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP, resist_physical REAL, resist_energy REAL, resist_distortion REAL, resist_thermal REAL, resist_biochemical REAL, resist_stun REAL, ir_emission REAL, em_emission REAL, item_port_count INTEGER, removed INTEGER NOT NULL DEFAULT 0, [can_loot] INTEGER, [grid_height] INTEGER, [grid_width] INTEGER, [inventory_volume] REAL, [loot_rarity] TEXT, [manufacturer_code] TEXT, [radiation_capacity] REAL, [radiation_dissipation] REAL, [temperature_max] REAL, [temperature_min] REAL, data_source TEXT, protected_body_parts TEXT, armor_weight TEXT, integrity_threshold REAL, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_fps_ammo_types (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid               TEXT NOT NULL,
  name               TEXT NOT NULL,
  display_name       TEXT,
  slug               TEXT,
  class_name         TEXT,
  caliber            TEXT,
  damage_per_round   REAL,
  damage_type        TEXT,
  projectile_speed   REAL,
  magazine_capacity  INTEGER,
  game_version_id    INTEGER NOT NULL REFERENCES game_versions(id),
  created_at         TEXT DEFAULT (datetime('now')), manufacturer_id INTEGER REFERENCES ptu_manufacturers(id), removed INTEGER NOT NULL DEFAULT 0, [ammo_type] TEXT, [damage_distortion] REAL, [damage_energy] REAL, [damage_physical] REAL, [speed] REAL, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT, damage_thermal REAL, damage_biochemical REAL, damage_stun REAL,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_fps_carryables (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT NOT NULL,
  name              TEXT NOT NULL,
  display_name      TEXT,
  slug              TEXT,
  class_name        TEXT,
  sub_type          TEXT,
  mass              REAL,
  interaction_type  TEXT,
  value             REAL,
  description       TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT DEFAULT (datetime('now')), removed INTEGER NOT NULL DEFAULT 0, [can_loot] INTEGER, [grade] INTEGER, [grid_height] INTEGER, [grid_width] INTEGER, [inventory_volume] REAL, [loot_rarity] TEXT, [manufacturer_code] TEXT, [size] INTEGER, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_consumable_effects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consumable_uuid TEXT NOT NULL,
  effect_key TEXT NOT NULL,
  magnitude REAL,
  duration_seconds REAL,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id), removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(consumable_uuid, effect_key)
);
CREATE TABLE IF NOT EXISTS ptu_consumable_effect_types (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  description TEXT,
  is_positive INTEGER DEFAULT 1,
  game_version_id INTEGER REFERENCES game_versions(id), data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(key)
);
CREATE TABLE IF NOT EXISTS ptu_consumables (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  class_name      TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  slug            TEXT,
  description     TEXT,
  type            TEXT,
  sub_type        TEXT,
  manufacturer_id INTEGER REFERENCES ptu_manufacturers(id),
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  created_at      TEXT    DEFAULT (datetime('now')),
  updated_at      TEXT    DEFAULT (datetime('now')), removed INTEGER NOT NULL DEFAULT 0, [can_loot] INTEGER, [grade] INTEGER, [grid_height] INTEGER, [grid_width] INTEGER, [inventory_volume] REAL, [loot_rarity] TEXT, [manufacturer_code] TEXT, [size] INTEGER, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_contract_generator_blueprint_pools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_generator_contract_id INTEGER NOT NULL REFERENCES ptu_contract_generator_contracts(id),
  crafting_blueprint_reward_pool_id INTEGER NOT NULL REFERENCES ptu_crafting_blueprint_reward_pools(id),
  chance REAL DEFAULT 1.0,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id)
, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT);
CREATE TABLE IF NOT EXISTS ptu_contract_generator_careers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_generator_id INTEGER NOT NULL REFERENCES ptu_contract_generators(id),
  debug_name TEXT NOT NULL,
  system TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id)
, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT);
CREATE TABLE IF NOT EXISTS ptu_contract_generator_contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  career_id INTEGER NOT NULL REFERENCES ptu_contract_generator_careers(id),
  uuid TEXT NOT NULL,
  debug_name TEXT NOT NULL,
  difficulty TEXT,
  template TEXT,
  min_standing TEXT,
  max_standing TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id), rep_reward INTEGER, rep_rewards_json TEXT, title_loc_key TEXT, desc_loc_key TEXT, item_rewards_json TEXT, completion_tags_json TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_contract_generators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  generator_key TEXT NOT NULL,
  display_name TEXT,
  faction_name TEXT,
  guild TEXT,
  mission_type TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id), description TEXT, focus TEXT, headquarters TEXT, leadership TEXT, faction_slug TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(generator_key)
);
CREATE TABLE IF NOT EXISTS ptu_contract_blueprint_reward_pools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_generator_key TEXT NOT NULL,
    crafting_blueprint_reward_pool_id INTEGER NOT NULL REFERENCES ptu_crafting_blueprint_reward_pools(id),
    chance REAL NOT NULL DEFAULT 1.0,
    game_version_id INTEGER REFERENCES game_versions(id)
, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT);
CREATE TABLE IF NOT EXISTS ptu_contracts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_key     TEXT    NOT NULL,
  giver            TEXT    NOT NULL,
  giver_slug       TEXT    NOT NULL,
  category         TEXT    NOT NULL,
  sequence_num     INTEGER,
  title            TEXT    NOT NULL,
  description      TEXT,
  reward_text      TEXT,
  reward_amount    INTEGER DEFAULT 0,
  reward_currency  TEXT,
  is_dynamic_reward INTEGER DEFAULT 0,
  is_active        INTEGER DEFAULT 1,
  notes            TEXT,
  game_version_id  INTEGER NOT NULL REFERENCES game_versions(id), requirements_json TEXT, removed INTEGER NOT NULL DEFAULT 0, reward_vehicle_slug TEXT, [name] TEXT, [slug] TEXT, [uuid] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(contract_key)
);
CREATE TABLE IF NOT EXISTS ptu_crafting_blueprint_reward_pools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    name TEXT,
    game_version_id INTEGER REFERENCES game_versions(id), data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
    UNIQUE(key)
);
CREATE TABLE IF NOT EXISTS ptu_crafting_resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    game_version_id INTEGER REFERENCES game_versions(id)
, removed INTEGER NOT NULL DEFAULT 0, [key] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT);
CREATE TABLE IF NOT EXISTS ptu_crafting_blueprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    tag TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    sub_type TEXT NOT NULL,
    product_entity_class TEXT,
    craft_time_seconds INTEGER NOT NULL DEFAULT 0,
    game_version_id INTEGER REFERENCES game_versions(id)
, removed INTEGER NOT NULL DEFAULT 0, is_default INTEGER NOT NULL DEFAULT 0, category_id INTEGER REFERENCES crafting_blueprint_categories(id), [description] TEXT, [output_item] TEXT, [slug] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT);
CREATE TABLE IF NOT EXISTS ptu_armor_resistance_profiles (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  physical          REAL,
  energy            REAL,
  distortion        REAL,
  thermal           REAL,
  biochemical       REAL,
  stun              REAL,
  impact_force      REAL,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')), removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_jurisdiction_infraction_overrides (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  jurisdiction_id     INTEGER NOT NULL REFERENCES ptu_law_jurisdictions(id),
  infraction_id       INTEGER NOT NULL REFERENCES ptu_law_infractions(id),
  overrides_json      TEXT,
  game_version_id     INTEGER NOT NULL REFERENCES game_versions(id),
  created_at          TEXT    DEFAULT (datetime('now')),
  updated_at          TEXT    DEFAULT (datetime('now')), data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(jurisdiction_id, infraction_id)
);
CREATE TABLE IF NOT EXISTS ptu_law_jurisdictions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                  TEXT    NOT NULL,
  name                  TEXT    NOT NULL,
  slug                  TEXT,
  parent_uuid           TEXT,
  respects_parent_laws  INTEGER DEFAULT 1,
  base_fine             INTEGER,
  is_prison             INTEGER DEFAULT 0,
  max_stolen_goods_scu  REAL,
  prohibited_goods_json TEXT,
  controlled_substances_json TEXT,
  game_version_id       INTEGER NOT NULL REFERENCES game_versions(id),
  created_at            TEXT    DEFAULT (datetime('now')),
  updated_at            TEXT    DEFAULT (datetime('now')), removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_law_infractions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  description       TEXT,
  severity          TEXT    NOT NULL,
  triggers_json     TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')), is_felony INTEGER, grace_allowance REAL, grace_allowance_cooldown REAL, grace_period REAL, grace_cooloff_scale REAL, display_grace_time INTEGER, escalated_fine_multiplier REAL, early_payment_period REAL, lifetime REAL, cool_off_time REAL, press_charges_notification_time REAL, remove_time_seconds REAL, felony_merits REAL, ignore_party_member INTEGER, hide_crime_notification INTEGER, hide_crime_journal INTEGER, removed INTEGER NOT NULL DEFAULT 0, [cool_off_seconds] REAL, [escalation_multiplier] REAL, [fine_amount] REAL, [lifetime_hours] REAL, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_harvestables (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  class_name      TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  slug            TEXT,
  description     TEXT,
  sub_type        TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  created_at      TEXT    DEFAULT (datetime('now')),
  updated_at      TEXT    DEFAULT (datetime('now')), removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_props (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  class_name      TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  slug            TEXT,
  description     TEXT,
  type            TEXT,
  sub_type        TEXT,
  manufacturer_id INTEGER REFERENCES ptu_manufacturers(id),
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  created_at      TEXT    DEFAULT (datetime('now')),
  updated_at      TEXT    DEFAULT (datetime('now')), removed INTEGER NOT NULL DEFAULT 0, [manufacturer_code] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_trade_commodities (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid            TEXT NOT NULL,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    class_name      TEXT,
    category        TEXT,        
    type_name       TEXT,        
    subtype_name    TEXT,        
    is_raw          INTEGER DEFAULT 0,  
    boxable         INTEGER DEFAULT 0,  
    scu_per_unit    REAL,        
    description     TEXT,
    game_version_id INTEGER REFERENCES game_versions(id),
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now')), removed INTEGER NOT NULL DEFAULT 0, [sub_category] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
    UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_refining_processes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  speed             TEXT    NOT NULL,
  quality           TEXT    NOT NULL,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')), removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_damage_types (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  slug            TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id), removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_factions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  description       TEXT,
  faction_type      TEXT,
  headquarters      TEXT,
  founded           TEXT,
  leadership        TEXT,
  area              TEXT,
  focus             TEXT,
  default_reaction  TEXT,
  can_arrest        INTEGER DEFAULT 0,
  polices_crime     INTEGER DEFAULT 0,
  no_legal_rights   INTEGER DEFAULT 0,
  allies_json       TEXT,
  enemies_json      TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')), removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_paints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT,
    name TEXT NOT NULL,
    slug TEXT,
    class_name TEXT,
    description TEXT,
    image_url TEXT,
    image_url_small TEXT,
    image_url_medium TEXT,
    image_url_large TEXT,
    raw_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_base_variant INTEGER DEFAULT 0,
    game_version_id INTEGER REFERENCES game_versions(id), [can_loot] INTEGER, [grade] INTEGER, [grid_height] INTEGER, [grid_width] INTEGER, [inventory_volume] REAL, [loot_rarity] TEXT, [manufacturer_code] TEXT, [size] INTEGER, [sub_type] TEXT, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
    UNIQUE(class_name)
);
CREATE TABLE IF NOT EXISTS ptu_shops (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  shop_type         TEXT,
  location_id       INTEGER REFERENCES ptu_star_map_locations(id),
  is_event          INTEGER DEFAULT 0,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')), location_label TEXT, franchise_uuid TEXT, display_name TEXT, inventory_type TEXT, removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT, component_type TEXT, scshop_label TEXT,
  UNIQUE(uuid)
);
CREATE TABLE IF NOT EXISTS ptu_vehicles (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                      TEXT,
  slug                      TEXT    NOT NULL,
  name                      TEXT    NOT NULL,
  class_name                TEXT,
  manufacturer_id           INTEGER REFERENCES ptu_manufacturers(id),
  vehicle_type_id           INTEGER REFERENCES vehicle_types(id),
  production_status_id      INTEGER REFERENCES production_statuses(id),
  size                      INTEGER,
  size_label                TEXT,
  focus                     TEXT,
  classification            TEXT,
  description               TEXT,
  length                    REAL,
  beam                      REAL,
  height                    REAL,
  mass                      REAL,
  cargo                     REAL,
  vehicle_inventory         REAL,
  crew_min                  INTEGER,
  crew_max                  INTEGER,
  speed_scm                 REAL,
  speed_max                 REAL,
  health                    REAL,
  pledge_price              REAL,
  price_auec                REAL,
  on_sale                   BOOLEAN DEFAULT FALSE,
  image_url                 TEXT,
  image_url_small           TEXT,
  image_url_medium          TEXT,
  image_url_large           TEXT,
  pledge_url                TEXT,
  game_version_id           INTEGER NOT NULL REFERENCES game_versions(id),
  raw_data                  TEXT,
  created_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
  parent_vehicle_id         INTEGER REFERENCES ptu_vehicles(id),
  is_paint_variant          INTEGER NOT NULL DEFAULT 0,
  boost_speed_back          INTEGER,
  angular_velocity_pitch    REAL,
  angular_velocity_yaw      REAL,
  angular_velocity_roll     REAL,
  fuel_capacity_hydrogen    REAL,
  fuel_capacity_quantum     REAL,
  thruster_count_main       INTEGER,
  thruster_count_maneuvering INTEGER,
  acquisition_type          TEXT, acquisition_source_name TEXT, cross_section_x REAL, cross_section_y REAL, cross_section_z REAL, ir_signature REAL, em_signature REAL, removed INTEGER NOT NULL DEFAULT 0, armor_hp INTEGER DEFAULT 0, armor_damage_physical REAL DEFAULT 1, armor_damage_energy REAL DEFAULT 1, armor_damage_distortion REAL DEFAULT 1, armor_damage_thermal REAL DEFAULT 1, armor_deflection_physical REAL DEFAULT 0, armor_deflection_energy REAL DEFAULT 0, armor_signal_ir REAL DEFAULT 1, armor_signal_em REAL DEFAULT 1, armor_signal_cs REAL DEFAULT 1, weapon_pool_size INTEGER DEFAULT 0, shield_pool_max INTEGER DEFAULT 0, replaced_by_vehicle_id INTEGER REFERENCES ptu_vehicles(id), [manufacturer_code] TEXT, [vehicle_type] TEXT, data_source TEXT, claim_time REAL, expedited_claim_time REAL, expedited_claim_cost INTEGER, is_pledgeable INTEGER NOT NULL DEFAULT 1, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT, short_slug TEXT, is_variant INTEGER NOT NULL DEFAULT 0, is_purchasable_ingame INTEGER NOT NULL DEFAULT 0,
  UNIQUE(slug)
);
CREATE TABLE IF NOT EXISTS ptu_manufacturers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  slug            TEXT    NOT NULL,
  code            TEXT,
  known_for       TEXT,
  description     TEXT,
  logo_url        TEXT,
  raw_data        TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP, class TEXT, removed INTEGER NOT NULL DEFAULT 0, data_source TEXT, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, deleted_in_patch TEXT,
  UNIQUE(uuid)
);

-- Indexes (mirroring base table indexes)
CREATE INDEX IF NOT EXISTS ptu_idx_npc_loadout_items_loadout ON ptu_npc_loadout_items(loadout_id);
CREATE INDEX IF NOT EXISTS ptu_idx_npc_loadout_items_item ON ptu_npc_loadout_items(item_name);
CREATE INDEX IF NOT EXISTS ptu_idx_npc_loadout_items_version ON ptu_npc_loadout_items(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_item_locations_source_key ON ptu_loot_item_locations(source_type, location_key);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_item_locations_loot_map ON ptu_loot_item_locations(loot_map_id);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_item_locations_version ON ptu_loot_item_locations(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_npc_loadout_items_hidden ON ptu_npc_loadout_items(is_hidden);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_item_locations_map_source
  ON ptu_loot_item_locations(loot_map_id, source_type);
CREATE INDEX IF NOT EXISTS ptu_idx_crafting_blueprints_type ON ptu_crafting_blueprints(type);
CREATE INDEX IF NOT EXISTS ptu_idx_crafting_blueprints_sub_type ON ptu_crafting_blueprints(sub_type);
CREATE INDEX IF NOT EXISTS ptu_idx_crafting_blueprints_game_version ON ptu_crafting_blueprints(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_mining_locations_system ON ptu_mining_locations(system);
CREATE INDEX IF NOT EXISTS ptu_idx_mining_locations_game_version ON ptu_mining_locations(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_salvageable_ships_base ON ptu_salvageable_ships(base_vehicle_id);
CREATE INDEX IF NOT EXISTS ptu_idx_salvageable_ships_version ON ptu_salvageable_ships(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_contract_bp_pools_generator ON ptu_contract_blueprint_reward_pools(contract_generator_key);
CREATE INDEX IF NOT EXISTS ptu_idx_contract_bp_pools_pool ON ptu_contract_blueprint_reward_pools(crafting_blueprint_reward_pool_id);
CREATE INDEX IF NOT EXISTS ptu_idx_contract_bp_pools_version ON ptu_contract_blueprint_reward_pools(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_cgbp_contract_id ON ptu_contract_generator_blueprint_pools(contract_generator_contract_id);
CREATE INDEX IF NOT EXISTS ptu_idx_terminals_shop ON ptu_terminals(shop_id);
CREATE INDEX IF NOT EXISTS ptu_idx_terminals_type ON ptu_terminals(terminal_type);
CREATE INDEX IF NOT EXISTS ptu_idx_terminals_uex ON ptu_terminals(uex_terminal_id);
CREATE INDEX IF NOT EXISTS ptu_idx_component_coolers_cid ON ptu_component_coolers(component_id);
CREATE INDEX IF NOT EXISTS ptu_idx_component_mining_cid ON ptu_component_mining(component_id);
CREATE INDEX IF NOT EXISTS ptu_idx_component_powerplants_cid ON ptu_component_powerplants(component_id);
CREATE INDEX IF NOT EXISTS ptu_idx_component_qed_cid ON ptu_component_qed(component_id);
CREATE INDEX IF NOT EXISTS ptu_idx_component_quantum_drives_cid ON ptu_component_quantum_drives(component_id);
CREATE INDEX IF NOT EXISTS ptu_idx_component_radar_cid ON ptu_component_radar(component_id);
CREATE INDEX IF NOT EXISTS ptu_idx_component_shields_cid ON ptu_component_shields(component_id);
CREATE INDEX IF NOT EXISTS ptu_idx_component_thrusters_cid ON ptu_component_thrusters(component_id);
CREATE INDEX IF NOT EXISTS ptu_idx_component_turrets_cid ON ptu_component_turrets(component_id);
CREATE INDEX IF NOT EXISTS ptu_idx_component_weapons_cid ON ptu_component_weapons(component_id);
CREATE INDEX IF NOT EXISTS ptu_idx_consumable_effects_uuid ON ptu_consumable_effects(consumable_uuid);
CREATE INDEX IF NOT EXISTS ptu_idx_consumable_effects_version ON ptu_consumable_effects(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_consumables_slug     ON ptu_consumables(slug);
CREATE INDEX IF NOT EXISTS ptu_idx_consumables_sub_type ON ptu_consumables(sub_type);
CREATE INDEX IF NOT EXISTS ptu_idx_consumables_type     ON ptu_consumables(type);
CREATE UNIQUE INDEX IF NOT EXISTS ptu_idx_cgbp_upsert
  ON ptu_contract_generator_blueprint_pools(contract_generator_contract_id, crafting_blueprint_reward_pool_id);
CREATE UNIQUE INDEX IF NOT EXISTS ptu_idx_cgc_upsert
  ON ptu_contract_generator_careers(debug_name, contract_generator_id);
CREATE INDEX IF NOT EXISTS ptu_idx_cgc_career_id ON ptu_contract_generator_contracts(career_id);
CREATE INDEX IF NOT EXISTS ptu_idx_cgc_desc_loc_key ON ptu_contract_generator_contracts(desc_loc_key);
CREATE INDEX IF NOT EXISTS ptu_idx_cg_faction_slug ON ptu_contract_generators(faction_slug, game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_cg_generator_key ON ptu_contract_generators(generator_key);
CREATE INDEX IF NOT EXISTS ptu_idx_contracts_giver_slug ON ptu_contracts(giver_slug);
CREATE INDEX IF NOT EXISTS ptu_idx_contracts_is_active  ON ptu_contracts(is_active);
CREATE INDEX IF NOT EXISTS ptu_idx_crafting_bp_reward_pools_version ON ptu_crafting_blueprint_reward_pools(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_faction_reputation_scopes_faction ON ptu_faction_reputation_scopes(faction_id);
CREATE INDEX IF NOT EXISTS ptu_idx_faction_reputation_scopes_scope ON ptu_faction_reputation_scopes(reputation_scope_id);
CREATE INDEX IF NOT EXISTS ptu_idx_faction_reputation_scopes_version ON ptu_faction_reputation_scopes(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_factions_slug ON ptu_factions(slug);
CREATE INDEX IF NOT EXISTS ptu_idx_factions_type ON ptu_factions(faction_type);
CREATE INDEX IF NOT EXISTS ptu_idx_fps_ammo_types_version ON ptu_fps_ammo_types(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_fps_carryables_version ON ptu_fps_carryables(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_fps_clothing_slot ON ptu_fps_clothing(slot);
CREATE INDEX IF NOT EXISTS ptu_idx_fps_clothing_slug ON ptu_fps_clothing(slug);
CREATE INDEX IF NOT EXISTS ptu_idx_fps_helmets_slug     ON ptu_fps_helmets(slug);
CREATE INDEX IF NOT EXISTS ptu_idx_fps_helmets_sub_type ON ptu_fps_helmets(sub_type);
CREATE INDEX IF NOT EXISTS ptu_idx_fps_melee_manufacturer ON ptu_fps_melee(manufacturer_id);
CREATE INDEX IF NOT EXISTS ptu_idx_fps_melee_version ON ptu_fps_melee(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_harvestables_slug ON ptu_harvestables(slug);
CREATE INDEX IF NOT EXISTS ptu_idx_jio_infraction ON ptu_jurisdiction_infraction_overrides(infraction_id);
CREATE INDEX IF NOT EXISTS ptu_idx_jio_jurisdiction ON ptu_jurisdiction_infraction_overrides(jurisdiction_id);
CREATE INDEX IF NOT EXISTS ptu_idx_law_infractions_severity ON ptu_law_infractions(severity);
CREATE INDEX IF NOT EXISTS ptu_idx_law_infractions_slug ON ptu_law_infractions(slug);
CREATE INDEX IF NOT EXISTS ptu_idx_law_jurisdictions_slug ON ptu_law_jurisdictions(slug);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_map_category ON ptu_loot_map(category);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_map_class_name ON ptu_loot_map(class_name);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_map_consumable   ON ptu_loot_map(consumable_id);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_map_fps_armour_id ON ptu_loot_map(fps_armour_id);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_map_fps_carryable ON ptu_loot_map(fps_carryable_id);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_map_fps_clothing_id ON ptu_loot_map(fps_clothing_id);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_map_fps_helmet_id ON ptu_loot_map(fps_helmet_id);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_map_fps_melee ON ptu_loot_map(fps_melee_id);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_map_fps_weapon_id ON ptu_loot_map(fps_weapon_id);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_map_game_version ON ptu_loot_map(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_map_harvestable  ON ptu_loot_map(harvestable_id);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_map_props        ON ptu_loot_map(props_id);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_map_rarity       ON ptu_loot_map(rarity);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_map_ship_missile ON ptu_loot_map(ship_missile_id);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_map_sub_type     ON ptu_loot_map(sub_type);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_map_type         ON ptu_loot_map(type);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_map_uuid_gv ON ptu_loot_map(uuid, game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_loot_map_vehicle_component_id ON ptu_loot_map(vehicle_component_id);
CREATE INDEX IF NOT EXISTS ptu_idx_mineable_elements_category ON ptu_mineable_elements(category);
CREATE INDEX IF NOT EXISTS ptu_idx_mineable_elements_slug ON ptu_mineable_elements(slug);
CREATE INDEX IF NOT EXISTS ptu_idx_mission_givers_faction ON ptu_mission_givers(faction_id);
CREATE INDEX IF NOT EXISTS ptu_idx_mission_givers_location ON ptu_mission_givers(location_id);
CREATE INDEX IF NOT EXISTS ptu_idx_mission_givers_slug ON ptu_mission_givers(slug);
CREATE INDEX IF NOT EXISTS ptu_idx_mission_organizations_slug ON ptu_mission_organizations(slug);
CREATE INDEX IF NOT EXISTS ptu_idx_mp_required ON ptu_mission_prerequisites(required_mission_id);
CREATE INDEX IF NOT EXISTS ptu_idx_mission_types_category ON ptu_mission_types(category);
CREATE INDEX IF NOT EXISTS ptu_idx_missions_category ON ptu_missions(category);
CREATE INDEX IF NOT EXISTS ptu_idx_missions_giver ON ptu_missions(mission_giver_id);
CREATE INDEX IF NOT EXISTS ptu_idx_missions_reputation ON ptu_missions(reputation_scope_id);
CREATE INDEX IF NOT EXISTS ptu_idx_missions_type ON ptu_missions(mission_type_id);
CREATE INDEX IF NOT EXISTS ptu_idx_missions_version ON ptu_missions(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_npc_loadouts_faction ON ptu_npc_loadouts(faction_id);
CREATE INDEX IF NOT EXISTS ptu_idx_npc_loadouts_version ON ptu_npc_loadouts(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_paints_class_name ON ptu_paints(class_name);
CREATE INDEX IF NOT EXISTS ptu_idx_paints_slug ON ptu_paints(slug);
CREATE INDEX IF NOT EXISTS ptu_idx_paints_version ON ptu_paints(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_props_slug     ON ptu_props(slug);
CREATE INDEX IF NOT EXISTS ptu_idx_props_sub_type ON ptu_props(sub_type);
CREATE INDEX IF NOT EXISTS ptu_idx_reputation_perks_scope ON ptu_reputation_perks(scope_id);
CREATE INDEX IF NOT EXISTS ptu_idx_reputation_perks_version ON ptu_reputation_perks(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_reputation_reward_tiers_version ON ptu_reputation_reward_tiers(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_reputation_scopes_key ON ptu_reputation_scopes(scope_key);
CREATE INDEX IF NOT EXISTS ptu_idx_reputation_standings_scope ON ptu_reputation_standings(scope_id);
CREATE INDEX IF NOT EXISTS ptu_idx_rock_compositions_rock_type ON ptu_rock_compositions(rock_type);
CREATE UNIQUE INDEX IF NOT EXISTS ptu_idx_salvageable_ships_uuid_version ON ptu_salvageable_ships(entity_uuid);
CREATE INDEX IF NOT EXISTS ptu_idx_ship_missiles_size ON ptu_ship_missiles(size);
CREATE INDEX IF NOT EXISTS ptu_idx_ship_missiles_type ON ptu_ship_missiles(type, sub_type);
CREATE INDEX IF NOT EXISTS ptu_idx_ship_missiles_uuid ON ptu_ship_missiles(uuid);
CREATE INDEX IF NOT EXISTS ptu_idx_shop_locations_location ON ptu_shop_locations(location_id);
CREATE INDEX IF NOT EXISTS ptu_idx_shop_locations_shop ON ptu_shop_locations(shop_id);
CREATE INDEX IF NOT EXISTS ptu_idx_shops_display_name ON ptu_shops(display_name);
CREATE INDEX IF NOT EXISTS ptu_idx_shops_franchise ON ptu_shops(franchise_uuid);
CREATE INDEX IF NOT EXISTS ptu_idx_shops_location ON ptu_shops(location_id);
CREATE INDEX IF NOT EXISTS ptu_idx_shops_slug ON ptu_shops(slug);
CREATE INDEX IF NOT EXISTS ptu_idx_shops_type ON ptu_shops(shop_type);
CREATE INDEX IF NOT EXISTS ptu_idx_star_map_locations_jurisdiction ON ptu_star_map_locations(jurisdiction_id);
CREATE INDEX IF NOT EXISTS ptu_idx_star_map_locations_parent ON ptu_star_map_locations(parent_uuid);
CREATE INDEX IF NOT EXISTS ptu_idx_star_map_locations_slug ON ptu_star_map_locations(slug);
CREATE INDEX IF NOT EXISTS ptu_idx_star_map_locations_system ON ptu_star_map_locations(star_system_id);
CREATE INDEX IF NOT EXISTS ptu_idx_star_map_locations_type ON ptu_star_map_locations(location_type);
CREATE INDEX IF NOT EXISTS ptu_idx_terminal_inventory_item ON ptu_terminal_inventory(item_uuid);
CREATE INDEX IF NOT EXISTS ptu_idx_terminal_inventory_terminal ON ptu_terminal_inventory(terminal_id);
CREATE INDEX IF NOT EXISTS ptu_idx_trade_commodities_category ON ptu_trade_commodities(category);
CREATE INDEX IF NOT EXISTS ptu_idx_trade_commodities_slug ON ptu_trade_commodities(slug);
CREATE INDEX IF NOT EXISTS ptu_idx_vehicle_modules_port ON ptu_vehicle_modules(vehicle_id, port_name);
CREATE INDEX IF NOT EXISTS ptu_idx_vehicle_modules_vehicle ON ptu_vehicle_modules(vehicle_id);
CREATE INDEX IF NOT EXISTS ptu_idx_vehicle_modules_version ON ptu_vehicle_modules(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_vehicle_ports_controller ON ptu_vehicle_ports(controller);
CREATE INDEX IF NOT EXISTS ptu_idx_vehicle_ports_parent_port_id ON ptu_vehicle_ports(parent_port_id);
CREATE INDEX IF NOT EXISTS ptu_idx_vehicle_ports_vehicle_id    ON ptu_vehicle_ports(vehicle_id);
CREATE INDEX IF NOT EXISTS ptu_idx_vehicle_suit_lockers_vehicle ON ptu_vehicle_suit_lockers(vehicle_id);
CREATE INDEX IF NOT EXISTS ptu_idx_vehicle_suit_lockers_version ON ptu_vehicle_suit_lockers(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_vehicle_weapon_racks_vehicle ON ptu_vehicle_weapon_racks(vehicle_id);
CREATE INDEX IF NOT EXISTS ptu_idx_vehicle_weapon_racks_version ON ptu_vehicle_weapon_racks(game_version_id);
CREATE INDEX IF NOT EXISTS ptu_idx_vehicles_is_pledgeable ON ptu_vehicles(is_pledgeable)
  WHERE is_pledgeable = 0;
CREATE INDEX IF NOT EXISTS ptu_idx_vehicles_manufacturer_id ON ptu_vehicles(manufacturer_id);
CREATE UNIQUE INDEX IF NOT EXISTS ptu_idx_lil_natural_key
  ON ptu_loot_item_locations(loot_map_id, source_type, location_key, COALESCE(location_label, ''));
CREATE UNIQUE INDEX IF NOT EXISTS ptu_idx_nli_natural_key
  ON ptu_npc_loadout_items(loadout_id, item_name, COALESCE(slot, ''));
CREATE UNIQUE INDEX IF NOT EXISTS ptu_idx_mining_gadgets_name
  ON ptu_mining_gadgets(name);
CREATE UNIQUE INDEX IF NOT EXISTS ptu_idx_mining_lasers_name
  ON ptu_mining_lasers(name);
CREATE UNIQUE INDEX IF NOT EXISTS ptu_idx_mining_modules_name
  ON ptu_mining_modules(name);
CREATE UNIQUE INDEX IF NOT EXISTS ptu_idx_mining_locations_key
  ON ptu_mining_locations(preset_file, name);
CREATE UNIQUE INDEX IF NOT EXISTS ptu_idx_mining_qd_name
  ON ptu_mining_quality_distributions(name);
CREATE INDEX IF NOT EXISTS ptu_idx_component_missiles_cid ON ptu_component_missiles(component_id);
CREATE INDEX IF NOT EXISTS ptu_idx_vehicles_is_variant ON ptu_vehicles(is_variant);
CREATE INDEX IF NOT EXISTS ptu_idx_vehicles_is_purchasable_ingame ON ptu_vehicles(is_purchasable_ingame);
CREATE INDEX IF NOT EXISTS ptu_idx_fps_weapons_has_builtin_scope ON ptu_fps_weapons(has_builtin_scope);
CREATE INDEX IF NOT EXISTS ptu_idx_mrr_mission ON ptu_mission_reputation_requirements(mission_id);
CREATE INDEX IF NOT EXISTS ptu_idx_mrr_faction ON ptu_mission_reputation_requirements(faction_slug);
CREATE INDEX IF NOT EXISTS ptu_idx_mrr_scope   ON ptu_mission_reputation_requirements(scope_slug);
