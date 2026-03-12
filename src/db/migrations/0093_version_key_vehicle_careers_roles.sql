-- Version-key vehicle_careers and vehicle_roles
-- These small reference tables need game_version_id so their data can vary
-- across game versions (careers/roles may be added or renamed between patches).

-- Disable FK checks during rebuild (child tables reference these via FK)
PRAGMA foreign_keys = OFF;

-- ── vehicle_careers ──────────────────────────────────────────────────

ALTER TABLE vehicle_careers RENAME TO vehicle_careers_old;

CREATE TABLE vehicle_careers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  slug            TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  UNIQUE(uuid, game_version_id)
);

INSERT INTO vehicle_careers (id, uuid, name, slug, game_version_id)
SELECT id, uuid, name, slug,
       (SELECT id FROM game_versions WHERE is_default = 1 LIMIT 1)
FROM vehicle_careers_old;

DROP TABLE vehicle_careers_old;

-- ── vehicle_roles ────────────────────────────────────────────────────

ALTER TABLE vehicle_roles RENAME TO vehicle_roles_old;

CREATE TABLE vehicle_roles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  slug            TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  UNIQUE(uuid, game_version_id)
);

INSERT INTO vehicle_roles (id, uuid, name, slug, game_version_id)
SELECT id, uuid, name, slug,
       (SELECT id FROM game_versions WHERE is_default = 1 LIMIT 1)
FROM vehicle_roles_old;

DROP TABLE vehicle_roles_old;

-- Re-enable FK checks
PRAGMA foreign_keys = ON;
