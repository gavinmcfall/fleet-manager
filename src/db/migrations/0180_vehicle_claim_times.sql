-- Add insurance claim time columns to vehicles
-- Data source: p4k StaticEntityClassData.shipInsuranceParams
ALTER TABLE vehicles ADD COLUMN claim_time REAL;
ALTER TABLE vehicles ADD COLUMN expedited_claim_time REAL;
ALTER TABLE vehicles ADD COLUMN expedited_claim_cost INTEGER;
