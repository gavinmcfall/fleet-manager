-- 0149_vehicle_replaced_by.sql
-- Track which vehicle replaces a removed variant.
-- When a variant is retired (e.g. Mole Carbon → base Mole + Carbon paint),
-- replaced_by_vehicle_id points to the base ship. Frontend uses this to
-- show the correct ship while preserving fleet history.

ALTER TABLE vehicles ADD COLUMN replaced_by_vehicle_id INTEGER REFERENCES vehicles(id);
