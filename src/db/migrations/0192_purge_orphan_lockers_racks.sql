-- Purge orphan rows from vehicle_suit_lockers + vehicle_weapon_racks where
-- vehicle_id IS NULL. These are entities in the p4k data whose owning ship
-- couldn't be matched. They can't be displayed (no ship to attach to), and
-- SQLite's NULL-is-distinct rule in UNIQUE(uuid, vehicle_id) lets them
-- accumulate as duplicates on every pipeline run.
--
-- The pipeline's vehicle-matching logic will re-emit these on the next run
-- if matching improves. No data loss — only unrenderable rows go.

DELETE FROM vehicle_suit_lockers WHERE vehicle_id IS NULL;
DELETE FROM vehicle_weapon_racks WHERE vehicle_id IS NULL;
