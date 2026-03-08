-- Vehicle career and role lookup tables + junction assignments
-- No FK dependencies on other new tables (vehicles already exists)

CREATE TABLE vehicle_careers (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid  TEXT    NOT NULL UNIQUE,
  name  TEXT    NOT NULL,
  slug  TEXT
);

CREATE TABLE vehicle_roles (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid  TEXT    NOT NULL UNIQUE,
  name  TEXT    NOT NULL,
  slug  TEXT
);

CREATE TABLE vehicle_career_assignments (
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  career_id  INTEGER NOT NULL REFERENCES vehicle_careers(id),
  PRIMARY KEY (vehicle_id, career_id)
);

CREATE TABLE vehicle_role_assignments (
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  role_id    INTEGER NOT NULL REFERENCES vehicle_roles(id),
  PRIMARY KEY (vehicle_id, role_id)
);
