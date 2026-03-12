-- Promote stats_json to proper columns on vehicle_components
-- Covers: PowerPlant, Cooler, Shield, QuantumDrive, Weapon, Turret, Thruster, Radar, QED

-- PowerPlant stats
ALTER TABLE vehicle_components ADD COLUMN power_output REAL;
ALTER TABLE vehicle_components ADD COLUMN overpower_performance REAL;
ALTER TABLE vehicle_components ADD COLUMN overclock_performance REAL;
ALTER TABLE vehicle_components ADD COLUMN overclock_threshold_min REAL;
ALTER TABLE vehicle_components ADD COLUMN overclock_threshold_max REAL;
ALTER TABLE vehicle_components ADD COLUMN thermal_output REAL;

-- Cooler stats
ALTER TABLE vehicle_components ADD COLUMN cooling_rate REAL;
ALTER TABLE vehicle_components ADD COLUMN max_temperature REAL;
ALTER TABLE vehicle_components ADD COLUMN overheat_temperature REAL;

-- Shield stats
ALTER TABLE vehicle_components ADD COLUMN shield_hp REAL;
ALTER TABLE vehicle_components ADD COLUMN shield_regen REAL;
ALTER TABLE vehicle_components ADD COLUMN resist_physical REAL;
ALTER TABLE vehicle_components ADD COLUMN resist_energy REAL;
ALTER TABLE vehicle_components ADD COLUMN resist_distortion REAL;
ALTER TABLE vehicle_components ADD COLUMN resist_thermal REAL;
ALTER TABLE vehicle_components ADD COLUMN regen_delay REAL;
ALTER TABLE vehicle_components ADD COLUMN downed_regen_delay REAL;

-- QuantumDrive stats
ALTER TABLE vehicle_components ADD COLUMN quantum_speed REAL;
ALTER TABLE vehicle_components ADD COLUMN quantum_range REAL;
ALTER TABLE vehicle_components ADD COLUMN fuel_rate REAL;
ALTER TABLE vehicle_components ADD COLUMN spool_time REAL;
ALTER TABLE vehicle_components ADD COLUMN cooldown_time REAL;
ALTER TABLE vehicle_components ADD COLUMN stage1_accel REAL;
ALTER TABLE vehicle_components ADD COLUMN stage2_accel REAL;

-- Weapon (WeaponGun) stats
ALTER TABLE vehicle_components ADD COLUMN rounds_per_minute REAL;
ALTER TABLE vehicle_components ADD COLUMN ammo_container_size INTEGER;
ALTER TABLE vehicle_components ADD COLUMN damage_per_shot REAL;
ALTER TABLE vehicle_components ADD COLUMN damage_type TEXT;
ALTER TABLE vehicle_components ADD COLUMN projectile_speed REAL;
ALTER TABLE vehicle_components ADD COLUMN effective_range REAL;
ALTER TABLE vehicle_components ADD COLUMN dps REAL;
ALTER TABLE vehicle_components ADD COLUMN heat_per_shot REAL;
ALTER TABLE vehicle_components ADD COLUMN power_draw REAL;
ALTER TABLE vehicle_components ADD COLUMN fire_modes TEXT;

-- Turret stats
ALTER TABLE vehicle_components ADD COLUMN rotation_speed REAL;
ALTER TABLE vehicle_components ADD COLUMN min_pitch REAL;
ALTER TABLE vehicle_components ADD COLUMN max_pitch REAL;
ALTER TABLE vehicle_components ADD COLUMN min_yaw REAL;
ALTER TABLE vehicle_components ADD COLUMN max_yaw REAL;
ALTER TABLE vehicle_components ADD COLUMN gimbal_type TEXT;

-- Thruster stats
ALTER TABLE vehicle_components ADD COLUMN thrust_force REAL;
ALTER TABLE vehicle_components ADD COLUMN fuel_burn_rate REAL;

-- Radar stats
ALTER TABLE vehicle_components ADD COLUMN radar_range REAL;
ALTER TABLE vehicle_components ADD COLUMN radar_angle REAL;

-- QED stats
ALTER TABLE vehicle_components ADD COLUMN qed_range REAL;
ALTER TABLE vehicle_components ADD COLUMN qed_strength REAL;

-- Populate from existing stats_json
UPDATE vehicle_components SET
  power_output = json_extract(stats_json, '$.power_output'),
  overpower_performance = json_extract(stats_json, '$.overpower_performance'),
  overclock_performance = json_extract(stats_json, '$.overclock_performance'),
  overclock_threshold_min = json_extract(stats_json, '$.overclock_threshold_min'),
  overclock_threshold_max = json_extract(stats_json, '$.overclock_threshold_max')
WHERE stats_json IS NOT NULL AND type = 'PowerPlant';

UPDATE vehicle_components SET
  cooling_rate = json_extract(stats_json, '$.cooling_rate'),
  max_temperature = json_extract(stats_json, '$.max_temperature'),
  overheat_temperature = json_extract(stats_json, '$.overheat_temperature')
WHERE stats_json IS NOT NULL AND type = 'Cooler';

UPDATE vehicle_components SET
  shield_hp = json_extract(stats_json, '$.max_shield_health'),
  shield_regen = json_extract(stats_json, '$.max_shield_regen'),
  regen_delay = json_extract(stats_json, '$.damaged_regen_delay'),
  downed_regen_delay = json_extract(stats_json, '$.downed_regen_delay'),
  resist_physical = json_extract(stats_json, '$.decay_ratio')
WHERE stats_json IS NOT NULL AND type = 'Shield';

UPDATE vehicle_components SET
  quantum_speed = json_extract(stats_json, '$.quantum_speed'),
  quantum_range = json_extract(stats_json, '$.quantum_range'),
  stage1_accel = json_extract(stats_json, '$.stage1_accel'),
  stage2_accel = json_extract(stats_json, '$.stage2_accel'),
  cooldown_time = json_extract(stats_json, '$.cooldown_time'),
  spool_time = json_extract(stats_json, '$.spool_up_time'),
  fuel_rate = json_extract(stats_json, '$.quantum_fuel_requirement')
WHERE stats_json IS NOT NULL AND type = 'QuantumDrive';

UPDATE vehicle_components SET
  rounds_per_minute = json_extract(stats_json, '$.rounds_per_minute'),
  ammo_container_size = json_extract(stats_json, '$.ammo_container_size'),
  fire_modes = json_extract(stats_json, '$.fire_modes'),
  power_draw = json_extract(stats_json, '$.power_draw')
WHERE stats_json IS NOT NULL AND type = 'WeaponGun';

UPDATE vehicle_components SET
  thrust_force = json_extract(stats_json, '$.thrustCapacity'),
  fuel_burn_rate = json_extract(stats_json, '$.fuelBurnRatePer10KNewton')
WHERE stats_json IS NOT NULL AND type = 'Thruster';

UPDATE vehicle_components SET
  radar_range = json_extract(stats_json, '$.radar_range'),
  radar_angle = json_extract(stats_json, '$.radar_angle')
WHERE stats_json IS NOT NULL AND type = 'Radar';

UPDATE vehicle_components SET
  qed_strength = json_extract(stats_json, '$.qed_jammer_strength'),
  qed_range = json_extract(stats_json, '$.qed_range')
WHERE stats_json IS NOT NULL AND type = 'EMP';
