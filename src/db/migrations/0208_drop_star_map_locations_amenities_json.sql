-- 0208_drop_star_map_locations_amenities_json.sql
--
-- Drop star_map_locations.amenities_json. Placeholder column defined in
-- migration 0060 (star_systems) but never populated by v1 OR v2 pipeline.
-- Intent was to store structured amenity data per location; never built.
-- 100% NULL across 2,004 rows. No code readers.

ALTER TABLE star_map_locations DROP COLUMN amenities_json;
