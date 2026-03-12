-- Promote stats_json to proper columns on fps_utilities

ALTER TABLE fps_utilities ADD COLUMN heal_amount REAL;
ALTER TABLE fps_utilities ADD COLUMN effect_duration REAL;
ALTER TABLE fps_utilities ADD COLUMN consumable_type TEXT;
ALTER TABLE fps_utilities ADD COLUMN damage REAL;
ALTER TABLE fps_utilities ADD COLUMN blast_radius REAL;
ALTER TABLE fps_utilities ADD COLUMN fuse_time REAL;
ALTER TABLE fps_utilities ADD COLUMN device_type TEXT;

-- Populate from existing stats_json
UPDATE fps_utilities SET
  heal_amount = json_extract(stats_json, '$.consumable_volume'),
  effect_duration = json_extract(stats_json, '$.consumable_doses'),
  consumable_type = json_extract(stats_json, '$.device_type'),
  blast_radius = json_extract(stats_json, '$.blast_radius'),
  damage = json_extract(stats_json, '$.pressure'),
  device_type = json_extract(stats_json, '$.device_type')
WHERE stats_json IS NOT NULL;
