-- Add stat columns to fps_clothing
-- Most clothing items have NULL stats (no SCItemSuitArmorParams)
-- but some armored clothing variants do have resistance stats

ALTER TABLE fps_clothing ADD COLUMN resist_physical REAL;
ALTER TABLE fps_clothing ADD COLUMN resist_energy REAL;
ALTER TABLE fps_clothing ADD COLUMN resist_distortion REAL;
ALTER TABLE fps_clothing ADD COLUMN resist_thermal REAL;
ALTER TABLE fps_clothing ADD COLUMN resist_biochemical REAL;
ALTER TABLE fps_clothing ADD COLUMN resist_stun REAL;
ALTER TABLE fps_clothing ADD COLUMN ir_emission REAL;
ALTER TABLE fps_clothing ADD COLUMN em_emission REAL;
ALTER TABLE fps_clothing ADD COLUMN storage_capacity INTEGER;
ALTER TABLE fps_clothing ADD COLUMN temperature_range_min REAL;
ALTER TABLE fps_clothing ADD COLUMN temperature_range_max REAL;

-- Populate from existing stats_json (most will be NULL)
UPDATE fps_clothing SET
  resist_physical = json_extract(stats_json, '$.physical_resistance'),
  resist_energy = json_extract(stats_json, '$.energy_resistance'),
  resist_distortion = json_extract(stats_json, '$.distortion_resistance'),
  resist_thermal = json_extract(stats_json, '$.thermal_resistance'),
  resist_biochemical = json_extract(stats_json, '$.biochemical_resistance'),
  resist_stun = json_extract(stats_json, '$.stun_resistance'),
  ir_emission = json_extract(stats_json, '$.ir_emission'),
  em_emission = json_extract(stats_json, '$.em_emission')
WHERE stats_json IS NOT NULL;
