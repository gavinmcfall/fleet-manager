-- Eliminate stats_json from mineable_elements by extracting to typed columns
ALTER TABLE mineable_elements ADD COLUMN instability REAL;
ALTER TABLE mineable_elements ADD COLUMN resistance REAL;
ALTER TABLE mineable_elements ADD COLUMN optimal_window_midpoint REAL;
ALTER TABLE mineable_elements ADD COLUMN optimal_window_randomness REAL;
ALTER TABLE mineable_elements ADD COLUMN optimal_window_thinness REAL;
ALTER TABLE mineable_elements ADD COLUMN explosion_multiplier REAL;
ALTER TABLE mineable_elements ADD COLUMN cluster_factor REAL;

UPDATE mineable_elements SET
  instability = json_extract(stats_json, '$.elementInstability'),
  resistance = json_extract(stats_json, '$.elementResistance'),
  optimal_window_midpoint = json_extract(stats_json, '$.elementOptimalWindowMidpoint'),
  optimal_window_randomness = json_extract(stats_json, '$.elementOptimalWindowMidpointRandomness'),
  optimal_window_thinness = json_extract(stats_json, '$.elementOptimalWindowThinness'),
  explosion_multiplier = json_extract(stats_json, '$.elementExplosionMultiplier'),
  cluster_factor = json_extract(stats_json, '$.elementClusterFactor')
WHERE stats_json IS NOT NULL;
