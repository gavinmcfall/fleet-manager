-- Add ship signature columns to vehicles table
-- Source: SSCSignatureSystemParams on all ship entity JSONs
-- Cross-section is a Vec3, signatures from baseSignatureParams array

ALTER TABLE vehicles ADD COLUMN cross_section_x REAL;
ALTER TABLE vehicles ADD COLUMN cross_section_y REAL;
ALTER TABLE vehicles ADD COLUMN cross_section_z REAL;
ALTER TABLE vehicles ADD COLUMN ir_signature REAL;
ALTER TABLE vehicles ADD COLUMN em_signature REAL;
