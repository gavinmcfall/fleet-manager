-- Add missile-specific columns to vehicle_components for MissileLauncher/MissileRack entries
ALTER TABLE vehicle_components ADD COLUMN ammo_count INTEGER;
ALTER TABLE vehicle_components ADD COLUMN missile_type TEXT;
ALTER TABLE vehicle_components ADD COLUMN lock_time REAL;
ALTER TABLE vehicle_components ADD COLUMN tracking_signal TEXT;
ALTER TABLE vehicle_components ADD COLUMN damage REAL;
ALTER TABLE vehicle_components ADD COLUMN blast_radius REAL;
ALTER TABLE vehicle_components ADD COLUMN speed REAL;
ALTER TABLE vehicle_components ADD COLUMN lock_range REAL;
