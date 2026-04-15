-- 0207_drop_star_map_locations_size_meters.sql
--
-- Drop star_map_locations.size_meters. Defined in migration 0060 but never
-- populated — 100% NULL across 2,004 rows. No code readers.

ALTER TABLE star_map_locations DROP COLUMN size_meters;
