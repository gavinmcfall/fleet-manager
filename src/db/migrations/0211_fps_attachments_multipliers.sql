-- 0211_fps_attachments_multipliers.sql
--
-- Add 3 weapon-stat multiplier columns to fps_attachments. The v2 extractor
-- (commit 8296f5d) walks SWeaponModifierComponentParams.modifier.weaponStats
-- and emits these multipliers; schema didn't have them.
--
-- Loadout builder uses these to compute final weapon stats with attachments.

ALTER TABLE fps_attachments ADD COLUMN fire_rate_multiplier REAL;
ALTER TABLE fps_attachments ADD COLUMN projectile_speed_multiplier REAL;
ALTER TABLE fps_attachments ADD COLUMN heat_generation_multiplier REAL;
