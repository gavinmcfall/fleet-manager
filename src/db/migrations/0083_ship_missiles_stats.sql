-- Promote stats_json to proper columns on ship_missiles
-- Also add new columns from Stream 1F

ALTER TABLE ship_missiles ADD COLUMN missile_type TEXT;
ALTER TABLE ship_missiles ADD COLUMN lock_time REAL;
ALTER TABLE ship_missiles ADD COLUMN tracking_signal TEXT;
ALTER TABLE ship_missiles ADD COLUMN damage REAL;
ALTER TABLE ship_missiles ADD COLUMN damage_type TEXT;
ALTER TABLE ship_missiles ADD COLUMN blast_radius REAL;
ALTER TABLE ship_missiles ADD COLUMN speed REAL;
ALTER TABLE ship_missiles ADD COLUMN lock_range REAL;
ALTER TABLE ship_missiles ADD COLUMN ammo_count INTEGER;

-- Populate from existing stats_json
UPDATE ship_missiles SET
  ammo_count = json_extract(stats_json, '$.num_missiles'),
  missile_type = json_extract(stats_json, '$.tags')
WHERE stats_json IS NOT NULL;
