-- 0237_vehicles_hull_hp_rename_health.sql
-- PART I2 — Real ship HP from XML <Part name="body" damageMax="N">
--
-- Background: `vehicles.health` was historically populated from
-- VehicleComponentParams.vehicleHullDamageNormalizationValue, which is
-- uniformly 2500 across all ships — it's a damage multiplier, NOT real HP.
-- Real per-ship HP lives in the vehicle implementation XML at
-- Scripts/Entities/Vehicles/Implementations/Xml/{CLASS}.xml as
-- <Part name="body" damageMax="N">.
--
-- This migration:
--   1. Renames `vehicles.health` to `vehicles.hull_damage_normalization`
--      (the column's actual original meaning)
--   2. Adds `vehicles.hull_hp` (REAL) for the real-HP value
--
-- Extractor change in a separate commit populates hull_hp from XML body part.
-- Frontend updates in ShipDetail.jsx + Loadout/index.jsx switch to read
-- ship.hull_hp instead of ship.health.

ALTER TABLE vehicles RENAME COLUMN health TO hull_damage_normalization;
ALTER TABLE vehicles ADD COLUMN hull_hp REAL;
