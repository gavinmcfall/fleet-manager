-- Migration 0200: add damage_thermal to fps_ammo_types.
-- Schema drift: fps_weapons has all 4 damage types (physical/energy/distortion/thermal)
-- but fps_ammo_types was missing damage_thermal. Pipeline emit includes
-- damage_thermal in the INSERT column list, failing with SQLITE_ERROR on load.
-- Surfaces when loading 4.7.1-live pipeline output to scbridge-staging 2026-04-15.

ALTER TABLE fps_ammo_types ADD COLUMN damage_thermal REAL;
