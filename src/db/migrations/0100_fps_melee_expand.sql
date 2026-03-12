-- Add missing columns to fps_melee to match extract script output
ALTER TABLE fps_melee ADD COLUMN heavy_damage REAL;
ALTER TABLE fps_melee ADD COLUMN attack_types REAL;
ALTER TABLE fps_melee ADD COLUMN can_block INTEGER;
ALTER TABLE fps_melee ADD COLUMN can_takedown INTEGER;
