-- Add new differentiating stats found in 4.7 DataCore but never extracted:
--   em_signature: EM signature from ItemResourceComponentParams (varies 496% on shields)
--   mass: physical mass from SEntityPhysicsControllerParams (varies by size + manufacturer)
--   hp: structural health from SHealthComponentParams (varies by size + grade)
--   base_heat_generation: from PhysType.temperature.itemResourceParams (varies by grade)
--   distortion_max: from SDistortionParams.Maximum (varies by grade)

ALTER TABLE vehicle_components ADD COLUMN em_signature REAL;
ALTER TABLE vehicle_components ADD COLUMN mass REAL;
ALTER TABLE vehicle_components ADD COLUMN hp REAL;
ALTER TABLE vehicle_components ADD COLUMN base_heat_generation REAL;
ALTER TABLE vehicle_components ADD COLUMN distortion_max REAL;
