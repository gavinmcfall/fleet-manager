-- Add missing quantum drive columns to vehicle_components
-- calibration_rate: how fast the QD calibrates (distinct from spool_time)
-- engage_speed: minimum speed threshold to initiate quantum jump
ALTER TABLE vehicle_components ADD COLUMN calibration_rate REAL;
ALTER TABLE vehicle_components ADD COLUMN engage_speed REAL;
