-- Migration 0179: Split vehicle_components stat columns into type-specific sub-tables.
-- Solves D1 100-column limit. Base table keeps identity + loot metadata + shared physics.
-- Each sub-table has component_id FK with ON DELETE CASCADE.

PRAGMA foreign_keys = OFF;

-- ============================================================
-- 1. CREATE SUB-TABLES
-- ============================================================

CREATE TABLE component_powerplants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  power_output REAL,
  overpower_performance REAL,
  overclock_performance REAL,
  overclock_threshold_min REAL,
  overclock_threshold_max REAL,
  UNIQUE(component_id, game_version_id)
);

CREATE TABLE component_coolers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  cooling_rate REAL,
  max_temperature REAL,
  overheat_temperature REAL,
  UNIQUE(component_id, game_version_id)
);

CREATE TABLE component_shields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES vehicle_components(id) ON DELETE CASCADE,
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
  absorb_physical_max REAL,
  UNIQUE(component_id, game_version_id)
);

CREATE TABLE component_quantum_drives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  quantum_speed REAL,
  quantum_range REAL,
  fuel_rate REAL,
  spool_time REAL,
  cooldown_time REAL,
  stage1_accel REAL,
  stage2_accel REAL,
  calibration_rate REAL,
  engage_speed REAL,
  UNIQUE(component_id, game_version_id)
);

CREATE TABLE component_weapons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES vehicle_components(id) ON DELETE CASCADE,
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
  interdiction_effect_time REAL,
  UNIQUE(component_id, game_version_id)
);

CREATE TABLE component_turrets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  rotation_speed REAL,
  min_pitch REAL,
  max_pitch REAL,
  min_yaw REAL,
  max_yaw REAL,
  gimbal_type TEXT,
  UNIQUE(component_id, game_version_id)
);

CREATE TABLE component_missiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  ammo_count INTEGER,
  missile_type TEXT,
  lock_time REAL,
  tracking_signal TEXT,
  damage REAL,
  blast_radius REAL,
  speed REAL,
  lock_range REAL,
  UNIQUE(component_id, game_version_id)
);

CREATE TABLE component_radar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  radar_range REAL,
  radar_angle REAL,
  UNIQUE(component_id, game_version_id)
);

CREATE TABLE component_thrusters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  thrust_force REAL,
  fuel_burn_rate REAL,
  UNIQUE(component_id, game_version_id)
);

CREATE TABLE component_qed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  qed_range REAL,
  qed_strength REAL,
  UNIQUE(component_id, game_version_id)
);

CREATE TABLE component_mining (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES vehicle_components(id) ON DELETE CASCADE,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  mining_throttle_speed REAL,
  min_calibration_requirement REAL,
  max_calibration_requirement REAL,
  UNIQUE(component_id, game_version_id)
);

-- ============================================================
-- 2. MIGRATE DATA from base table into sub-tables
-- ============================================================

INSERT INTO component_powerplants (component_id, game_version_id, power_output, overpower_performance, overclock_performance, overclock_threshold_min, overclock_threshold_max)
SELECT id, game_version_id, power_output, overpower_performance, overclock_performance, overclock_threshold_min, overclock_threshold_max
FROM vehicle_components WHERE power_output IS NOT NULL AND power_output != 0;

INSERT INTO component_coolers (component_id, game_version_id, cooling_rate, max_temperature, overheat_temperature)
SELECT id, game_version_id, cooling_rate, max_temperature, overheat_temperature
FROM vehicle_components WHERE cooling_rate IS NOT NULL AND cooling_rate != 0;

INSERT INTO component_shields (component_id, game_version_id, shield_hp, shield_regen, resist_physical, resist_energy, resist_distortion, resist_thermal, regen_delay, downed_regen_delay, resist_physical_min, resist_energy_min, resist_distortion_min, resist_thermal_min, absorb_physical_min, absorb_physical_max)
SELECT id, game_version_id, shield_hp, shield_regen, resist_physical, resist_energy, resist_distortion, resist_thermal, regen_delay, downed_regen_delay, resist_physical_min, resist_energy_min, resist_distortion_min, resist_thermal_min, absorb_physical_min, absorb_physical_max
FROM vehicle_components WHERE shield_hp IS NOT NULL AND shield_hp != 0;

INSERT INTO component_quantum_drives (component_id, game_version_id, quantum_speed, quantum_range, fuel_rate, spool_time, cooldown_time, stage1_accel, stage2_accel, calibration_rate, engage_speed)
SELECT id, game_version_id, quantum_speed, quantum_range, fuel_rate, spool_time, cooldown_time, stage1_accel, stage2_accel, calibration_rate, engage_speed
FROM vehicle_components WHERE quantum_speed IS NOT NULL AND quantum_speed != 0;

INSERT INTO component_weapons (component_id, game_version_id, rounds_per_minute, ammo_container_size, damage_per_shot, damage_type, projectile_speed, effective_range, dps, heat_per_shot, fire_modes, damage_physical, damage_energy, damage_distortion, damage_thermal, penetration, weapon_range, laser_instability, optimal_charge_window_size, resistance_modifier, shatter_damage_modifier, optimal_charge_rate, catastrophic_charge_rate, filter_modifier)
SELECT id, game_version_id, rounds_per_minute, ammo_container_size, damage_per_shot, damage_type, projectile_speed, effective_range, dps, heat_per_shot, fire_modes, damage_physical, damage_energy, damage_distortion, damage_thermal, penetration, weapon_range, laser_instability, optimal_charge_window_size, resistance_modifier, shatter_damage_modifier, optimal_charge_rate, catastrophic_charge_rate, filter_modifier
FROM vehicle_components WHERE rounds_per_minute IS NOT NULL AND rounds_per_minute != 0;

INSERT INTO component_turrets (component_id, game_version_id, rotation_speed, min_pitch, max_pitch, min_yaw, max_yaw, gimbal_type)
SELECT id, game_version_id, rotation_speed, min_pitch, max_pitch, min_yaw, max_yaw, gimbal_type
FROM vehicle_components WHERE rotation_speed IS NOT NULL AND rotation_speed != 0;

INSERT INTO component_missiles (component_id, game_version_id, ammo_count, missile_type, lock_time, tracking_signal, damage, blast_radius, speed, lock_range)
SELECT id, game_version_id, ammo_count, missile_type, lock_time, tracking_signal, damage, blast_radius, speed, lock_range
FROM vehicle_components WHERE ammo_count IS NOT NULL AND ammo_count != 0;

INSERT INTO component_radar (component_id, game_version_id, radar_range, radar_angle)
SELECT id, game_version_id, radar_range, radar_angle
FROM vehicle_components WHERE radar_range IS NOT NULL AND radar_range != 0;

INSERT INTO component_thrusters (component_id, game_version_id, thrust_force, fuel_burn_rate)
SELECT id, game_version_id, thrust_force, fuel_burn_rate
FROM vehicle_components WHERE thrust_force IS NOT NULL AND thrust_force != 0;

INSERT INTO component_qed (component_id, game_version_id, qed_range, qed_strength)
SELECT id, game_version_id, qed_range, qed_strength
FROM vehicle_components WHERE qed_range IS NOT NULL AND qed_range != 0;

-- component_mining: no data to migrate yet (mining columns were blocked by 100-col limit)

-- ============================================================
-- 3. REBUILD base table with only common columns
-- ============================================================

CREATE TABLE vehicle_components_new (
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
  data_source TEXT,
  UNIQUE(uuid, game_version_id)
);

INSERT INTO vehicle_components_new (
  id, uuid, name, slug, class_name, manufacturer_id, type, sub_type, size, grade,
  description, game_version_id, raw_data, created_at, updated_at, class,
  component_class, em_signature, mass, hp, power_draw, power_draw_min,
  thermal_output, base_heat_generation, distortion_max, removed, manufacturer_code
)
SELECT
  id, uuid, name, slug, class_name, manufacturer_id, type, sub_type, size, grade,
  description, game_version_id, raw_data, created_at, updated_at, class,
  component_class, em_signature, mass, hp, power_draw, power_draw_min,
  thermal_output, base_heat_generation, distortion_max, removed, manufacturer_code
FROM vehicle_components;

DROP TABLE vehicle_components;
ALTER TABLE vehicle_components_new RENAME TO vehicle_components;

-- ============================================================
-- 4. INDEXES
-- ============================================================

CREATE INDEX idx_component_powerplants_cid ON component_powerplants(component_id);
CREATE INDEX idx_component_coolers_cid ON component_coolers(component_id);
CREATE INDEX idx_component_shields_cid ON component_shields(component_id);
CREATE INDEX idx_component_quantum_drives_cid ON component_quantum_drives(component_id);
CREATE INDEX idx_component_weapons_cid ON component_weapons(component_id);
CREATE INDEX idx_component_turrets_cid ON component_turrets(component_id);
CREATE INDEX idx_component_missiles_cid ON component_missiles(component_id);
CREATE INDEX idx_component_radar_cid ON component_radar(component_id);
CREATE INDEX idx_component_thrusters_cid ON component_thrusters(component_id);
CREATE INDEX idx_component_qed_cid ON component_qed(component_id);
CREATE INDEX idx_component_mining_cid ON component_mining(component_id);

PRAGMA foreign_keys = ON;
