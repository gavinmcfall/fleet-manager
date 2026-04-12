-- Fix dangling FK references on vehicle_career_assignments + vehicle_role_assignments.
-- Migration 0189 rebuilt vehicle_careers and vehicle_roles but didn't update the
-- child assignment tables; their FK strings still point to "vehicle_careers_old"
-- and "vehicle_roles_old" which no longer exist. This breaks any FK-touching
-- operation (including DELETE) with SQLITE_ERROR: no such table.
--
-- Fix by recreating both assignment tables with correct FK strings. Any data is
-- preserved via INSERT ... SELECT from the old copy.

-- vehicle_career_assignments
CREATE TABLE vehicle_career_assignments_new (
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  career_id  INTEGER NOT NULL REFERENCES vehicle_careers(id),
  PRIMARY KEY (vehicle_id, career_id)
);
INSERT INTO vehicle_career_assignments_new (vehicle_id, career_id)
  SELECT DISTINCT vehicle_id, career_id FROM vehicle_career_assignments
  WHERE EXISTS (SELECT 1 FROM vehicles WHERE vehicles.id = vehicle_career_assignments.vehicle_id)
    AND EXISTS (SELECT 1 FROM vehicle_careers WHERE vehicle_careers.id = vehicle_career_assignments.career_id);
DROP TABLE vehicle_career_assignments;
ALTER TABLE vehicle_career_assignments_new RENAME TO vehicle_career_assignments;

-- vehicle_role_assignments
CREATE TABLE vehicle_role_assignments_new (
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  role_id    INTEGER NOT NULL REFERENCES vehicle_roles(id),
  PRIMARY KEY (vehicle_id, role_id)
);
INSERT INTO vehicle_role_assignments_new (vehicle_id, role_id)
  SELECT DISTINCT vehicle_id, role_id FROM vehicle_role_assignments
  WHERE EXISTS (SELECT 1 FROM vehicles WHERE vehicles.id = vehicle_role_assignments.vehicle_id)
    AND EXISTS (SELECT 1 FROM vehicle_roles WHERE vehicle_roles.id = vehicle_role_assignments.role_id);
DROP TABLE vehicle_role_assignments;
ALTER TABLE vehicle_role_assignments_new RENAME TO vehicle_role_assignments;
