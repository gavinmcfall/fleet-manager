-- Combat stats for loadout page: per-type damage, armor, signatures, power pools.
-- Adds columns to existing tables rather than creating new ones.

-- ============================================================
-- vehicle_components: per-type damage breakdown + penetration
-- Currently has damage_type (string) and damage_per_shot (total).
-- Add individual damage type columns so DPS can be broken down.
-- ============================================================
ALTER TABLE vehicle_components ADD COLUMN damage_physical REAL DEFAULT 0;
ALTER TABLE vehicle_components ADD COLUMN damage_energy REAL DEFAULT 0;
ALTER TABLE vehicle_components ADD COLUMN damage_distortion REAL DEFAULT 0;
ALTER TABLE vehicle_components ADD COLUMN damage_thermal REAL DEFAULT 0;
ALTER TABLE vehicle_components ADD COLUMN penetration REAL DEFAULT 0;
ALTER TABLE vehicle_components ADD COLUMN weapon_range REAL DEFAULT 0;

-- Shield min resistances (existing columns are the max values)
ALTER TABLE vehicle_components ADD COLUMN resist_physical_min REAL DEFAULT 0;
ALTER TABLE vehicle_components ADD COLUMN resist_energy_min REAL DEFAULT 0;
ALTER TABLE vehicle_components ADD COLUMN resist_distortion_min REAL DEFAULT 0;
ALTER TABLE vehicle_components ADD COLUMN resist_thermal_min REAL DEFAULT 0;

-- Shield absorption (bleed-through to hull)
ALTER TABLE vehicle_components ADD COLUMN absorb_physical_min REAL DEFAULT 0;
ALTER TABLE vehicle_components ADD COLUMN absorb_physical_max REAL DEFAULT 0;

-- ============================================================
-- vehicles: armor stats, power pools, signatures
-- Some columns already exist (cross_section_*, ir_signature, em_signature,
-- fuel_capacity_*, health) but are NULL. These will be populated.
-- Add armor-specific and power pool columns.
-- ============================================================
ALTER TABLE vehicles ADD COLUMN armor_hp INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN armor_damage_physical REAL DEFAULT 1;
ALTER TABLE vehicles ADD COLUMN armor_damage_energy REAL DEFAULT 1;
ALTER TABLE vehicles ADD COLUMN armor_damage_distortion REAL DEFAULT 1;
ALTER TABLE vehicles ADD COLUMN armor_damage_thermal REAL DEFAULT 1;
ALTER TABLE vehicles ADD COLUMN armor_deflection_physical REAL DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN armor_deflection_energy REAL DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN armor_signal_ir REAL DEFAULT 1;
ALTER TABLE vehicles ADD COLUMN armor_signal_em REAL DEFAULT 1;
ALTER TABLE vehicles ADD COLUMN armor_signal_cs REAL DEFAULT 1;
ALTER TABLE vehicles ADD COLUMN weapon_pool_size INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN shield_pool_max INTEGER DEFAULT 0;
