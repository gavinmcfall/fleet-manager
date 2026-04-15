-- 0204_drop_star_map_locations_qt_radii.sql
--
-- Drop 3 quantum-travel radius columns from star_map_locations. Defined in
-- migration 0060 (star_systems) but never populated — 100% NULL across 2,004
-- rows. No code readers in src/ or frontend/ (grep verified 2026-04-15).

ALTER TABLE star_map_locations DROP COLUMN qt_adoption_radius;
ALTER TABLE star_map_locations DROP COLUMN qt_arrival_radius;
ALTER TABLE star_map_locations DROP COLUMN qt_obstruction_radius;
