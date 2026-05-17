-- 0239_vehicles_storage_summary_cols.sql
-- PART L Track 1 — denormalized summary columns derived from vehicle_storage (0238) aggregates.
-- vehicles.cargo stays = internal_cargo_scu for backwards compat with existing UI consumers.

ALTER TABLE vehicles ADD COLUMN internal_cargo_scu REAL;
ALTER TABLE vehicles ADD COLUMN external_cargo_scu REAL;
ALTER TABLE vehicles ADD COLUMN fuel_cargo_scu REAL;
ALTER TABLE vehicles ADD COLUMN personal_grid_microscu REAL;
ALTER TABLE vehicles ADD COLUMN locker_count INTEGER DEFAULT 0;
