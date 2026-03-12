-- Promote stats_json to proper columns on fps_weapons

ALTER TABLE fps_weapons ADD COLUMN rounds_per_minute REAL;
ALTER TABLE fps_weapons ADD COLUMN fire_modes TEXT;
ALTER TABLE fps_weapons ADD COLUMN burst_count INTEGER;
ALTER TABLE fps_weapons ADD COLUMN ammo_capacity INTEGER;
ALTER TABLE fps_weapons ADD COLUMN zoom_factor REAL;
ALTER TABLE fps_weapons ADD COLUMN item_port_count INTEGER;
ALTER TABLE fps_weapons ADD COLUMN damage REAL;
ALTER TABLE fps_weapons ADD COLUMN damage_type TEXT;
ALTER TABLE fps_weapons ADD COLUMN projectile_speed REAL;
ALTER TABLE fps_weapons ADD COLUMN effective_range REAL;
ALTER TABLE fps_weapons ADD COLUMN dps REAL;

-- Populate from existing stats_json
UPDATE fps_weapons SET
  rounds_per_minute = json_extract(stats_json, '$.rounds_per_minute'),
  fire_modes = json_extract(stats_json, '$.fire_modes'),
  burst_count = json_extract(stats_json, '$.burst_count'),
  ammo_capacity = json_extract(stats_json, '$.ammo_capacity'),
  zoom_factor = json_extract(stats_json, '$.zoom_factor'),
  item_port_count = json_extract(stats_json, '$.item_port_count')
WHERE stats_json IS NOT NULL;
