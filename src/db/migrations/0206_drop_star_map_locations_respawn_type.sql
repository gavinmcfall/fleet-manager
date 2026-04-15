-- 0206_drop_star_map_locations_respawn_type.sql
--
-- Drop star_map_locations.respawn_type. Defined in migration 0060 but never
-- populated — 100% NULL across 2,004 rows. No code readers.

ALTER TABLE star_map_locations DROP COLUMN respawn_type;
