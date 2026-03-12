-- Promote stats_json to proper columns on fps_helmets

ALTER TABLE fps_helmets ADD COLUMN resist_physical REAL;
ALTER TABLE fps_helmets ADD COLUMN resist_energy REAL;
ALTER TABLE fps_helmets ADD COLUMN resist_distortion REAL;
ALTER TABLE fps_helmets ADD COLUMN resist_thermal REAL;
ALTER TABLE fps_helmets ADD COLUMN resist_biochemical REAL;
ALTER TABLE fps_helmets ADD COLUMN resist_stun REAL;
ALTER TABLE fps_helmets ADD COLUMN ir_emission REAL;
ALTER TABLE fps_helmets ADD COLUMN em_emission REAL;
ALTER TABLE fps_helmets ADD COLUMN item_port_count INTEGER;
ALTER TABLE fps_helmets ADD COLUMN atmosphere_capacity REAL;

-- Populate from existing stats_json
UPDATE fps_helmets SET
  resist_physical = json_extract(stats_json, '$.physical_resistance'),
  resist_energy = json_extract(stats_json, '$.energy_resistance'),
  resist_distortion = json_extract(stats_json, '$.distortion_resistance'),
  resist_thermal = json_extract(stats_json, '$.thermal_resistance'),
  resist_biochemical = json_extract(stats_json, '$.biochemical_resistance'),
  resist_stun = json_extract(stats_json, '$.stun_resistance'),
  ir_emission = json_extract(stats_json, '$.ir_emission'),
  em_emission = json_extract(stats_json, '$.em_emission'),
  item_port_count = json_extract(stats_json, '$.item_port_count'),
  atmosphere_capacity = json_extract(stats_json, '$.atmosphere_capacity')
WHERE stats_json IS NOT NULL;
