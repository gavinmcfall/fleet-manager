-- Expand fps_attachments with columns for three attachment categories:
--   1. Optics — scope zeroing, low-light capability
--   2. Barrel mods — recoil and spread modifiers (compensators, suppressors, etc.)
--   3. Underbarrel lights — flashlights, laser pointers

-- Optics columns
ALTER TABLE fps_attachments ADD COLUMN scope_type TEXT;
ALTER TABLE fps_attachments ADD COLUMN zeroing_range REAL;
ALTER TABLE fps_attachments ADD COLUMN zeroing_increment REAL;
ALTER TABLE fps_attachments ADD COLUMN auto_zeroing_time REAL;
ALTER TABLE fps_attachments ADD COLUMN is_low_light INTEGER DEFAULT 0;

-- Barrel mod columns (recoil/spread modifiers)
ALTER TABLE fps_attachments ADD COLUMN recoil_decay REAL;
ALTER TABLE fps_attachments ADD COLUMN recoil_strength REAL;
ALTER TABLE fps_attachments ADD COLUMN recoil_randomness REAL;
ALTER TABLE fps_attachments ADD COLUMN spread_min REAL;
ALTER TABLE fps_attachments ADD COLUMN spread_max REAL;
ALTER TABLE fps_attachments ADD COLUMN spread_attack_time REAL;
ALTER TABLE fps_attachments ADD COLUMN spread_decay_time REAL;

-- Underbarrel light columns
ALTER TABLE fps_attachments ADD COLUMN light_type TEXT;
ALTER TABLE fps_attachments ADD COLUMN light_color TEXT;
ALTER TABLE fps_attachments ADD COLUMN light_intensity REAL;
ALTER TABLE fps_attachments ADD COLUMN light_radius REAL;
ALTER TABLE fps_attachments ADD COLUMN light_fov REAL;
