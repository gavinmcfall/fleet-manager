-- 0205_drop_star_map_locations_nav_icon.sql
--
-- Drop star_map_locations.nav_icon. Defined in migration 0060 but never
-- populated — 100% NULL across 2,004 rows. No code readers (grep verified
-- 2026-04-15: only hits in migrations and audit reports).

ALTER TABLE star_map_locations DROP COLUMN nav_icon;
