-- Migration 0196: add BA/user-scoped columns that app code uses
-- but were never added to committed migrations.
-- Discovered 2026-04-14 during Phase A NERDZ→SC Bridge rehearsal —
-- NERDZ has these columns (added out-of-band), app code references them
-- (37 refs across orgs.ts / fleet.ts / localization.ts), but scbridge-production
-- migrations 0001-0195 don't create them. Fresh prod would break.

ALTER TABLE organization ADD COLUMN rsiSid TEXT;
ALTER TABLE organization ADD COLUMN rsiUrl TEXT;
ALTER TABLE organization ADD COLUMN homepage TEXT;
ALTER TABLE organization ADD COLUMN discord TEXT;
ALTER TABLE organization ADD COLUMN twitch TEXT;
ALTER TABLE organization ADD COLUMN youtube TEXT;

ALTER TABLE user_localization_configs ADD COLUMN enhance_blueprint_pools INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_localization_configs ADD COLUMN enhance_contraband_warnings INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_localization_configs ADD COLUMN enhance_material_names INTEGER NOT NULL DEFAULT 0;
