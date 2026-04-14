-- Migration 0201: close schema drifts blocking the 2026-04-15 pipeline load.
--
-- Audit of pipeline-emitted INSERT column lists vs live scbridge-staging
-- schema surfaced 3 tables with missing columns the pipeline tries to write:
--   fps_ammo_types     → damage_biochemical, damage_stun
--   shops              → component_type, scshop_label
--   vehicle_suit_lockers → entity_name, port_name, min_size, max_size
--
-- 0200 added damage_thermal; 0201 closes the rest in one shot so the next
-- load doesn't hit another drift round-trip.

ALTER TABLE fps_ammo_types ADD COLUMN damage_biochemical REAL;
ALTER TABLE fps_ammo_types ADD COLUMN damage_stun REAL;

ALTER TABLE shops ADD COLUMN component_type TEXT;
ALTER TABLE shops ADD COLUMN scshop_label TEXT;

ALTER TABLE vehicle_suit_lockers ADD COLUMN entity_name TEXT;
ALTER TABLE vehicle_suit_lockers ADD COLUMN port_name TEXT;
ALTER TABLE vehicle_suit_lockers ADD COLUMN min_size INTEGER;
ALTER TABLE vehicle_suit_lockers ADD COLUMN max_size INTEGER;
