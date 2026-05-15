-- Drop dangling FK on mineable_elements + ptu_mineable_elements.
--
-- Migration 0057 created `commodities` table; migration 0069 replaced it with
-- `trade_commodities`. The `commodity_id INTEGER REFERENCES commodities(id)`
-- FK on mineable_elements was never updated and now points at a non-existent
-- table. Remote D1 silently ignores; miniflare-local enforces and breaks
-- `INSERT INTO mineable_elements ...` with `no such table: main.commodities:
-- SQLITE_ERROR`, blocking full local validation of the v2 pipeline load.
--
-- Same dangling FK on ptu_mineable_elements (mig 0215 mirrored the broken
-- shape from base into the PTU shadow). Both fixed here.
--
-- The column `commodity_id` itself stays (still referenced by pipeline
-- UPSERTs as a soft lookup via `(SELECT id FROM trade_commodities WHERE
-- uuid='...')`) — just the broken FK constraint is dropped.

-- ── mineable_elements ─────────────────────────────────────────────────
ALTER TABLE mineable_elements RENAME TO mineable_elements_old;

CREATE TABLE mineable_elements (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                        TEXT    NOT NULL,
  name                        TEXT    NOT NULL,
  slug                        TEXT,
  class_name                  TEXT,
  category                    TEXT,
  commodity_id                INTEGER,
  game_version_id             INTEGER NOT NULL REFERENCES game_versions(id),
  created_at                  TEXT    DEFAULT (datetime('now')),
  updated_at                  TEXT    DEFAULT (datetime('now')),
  instability                 REAL,
  resistance                  REAL,
  optimal_window_midpoint     REAL,
  optimal_window_randomness   REAL,
  optimal_window_thinness     REAL,
  explosion_multiplier        REAL,
  cluster_factor              REAL,
  removed                     INTEGER NOT NULL DEFAULT 0,
  resource_type               TEXT,
  data_source                 TEXT,
  optimal_midpoint            REAL,
  is_deleted                  INTEGER DEFAULT 0,
  deleted_at                  TEXT,
  deleted_in_patch            TEXT,
  UNIQUE(uuid)
);

INSERT INTO mineable_elements (
  id, uuid, name, slug, class_name, category, commodity_id, game_version_id,
  created_at, updated_at, instability, resistance, optimal_window_midpoint,
  optimal_window_randomness, optimal_window_thinness, explosion_multiplier,
  cluster_factor, removed, resource_type, data_source, optimal_midpoint,
  is_deleted, deleted_at, deleted_in_patch
)
SELECT
  id, uuid, name, slug, class_name, category, commodity_id, game_version_id,
  created_at, updated_at, instability, resistance, optimal_window_midpoint,
  optimal_window_randomness, optimal_window_thinness, explosion_multiplier,
  cluster_factor, removed, resource_type, data_source, optimal_midpoint,
  is_deleted, deleted_at, deleted_in_patch
FROM mineable_elements_old;

DROP TABLE mineable_elements_old;

CREATE INDEX idx_mineable_elements_category ON mineable_elements(category);
CREATE INDEX idx_mineable_elements_slug     ON mineable_elements(slug);

-- ── ptu_mineable_elements ─────────────────────────────────────────────
ALTER TABLE ptu_mineable_elements RENAME TO ptu_mineable_elements_old;

CREATE TABLE ptu_mineable_elements (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                        TEXT    NOT NULL,
  name                        TEXT    NOT NULL,
  slug                        TEXT,
  class_name                  TEXT,
  category                    TEXT,
  commodity_id                INTEGER,
  game_version_id             INTEGER NOT NULL REFERENCES game_versions(id),
  created_at                  TEXT    DEFAULT (datetime('now')),
  updated_at                  TEXT    DEFAULT (datetime('now')),
  instability                 REAL,
  resistance                  REAL,
  optimal_window_midpoint     REAL,
  optimal_window_randomness   REAL,
  optimal_window_thinness     REAL,
  explosion_multiplier        REAL,
  cluster_factor              REAL,
  removed                     INTEGER NOT NULL DEFAULT 0,
  optimal_midpoint            REAL,
  resource_type               TEXT,
  data_source                 TEXT,
  is_deleted                  INTEGER DEFAULT 0,
  deleted_at                  TEXT,
  deleted_in_patch            TEXT,
  UNIQUE(uuid)
);

INSERT INTO ptu_mineable_elements (
  id, uuid, name, slug, class_name, category, commodity_id, game_version_id,
  created_at, updated_at, instability, resistance, optimal_window_midpoint,
  optimal_window_randomness, optimal_window_thinness, explosion_multiplier,
  cluster_factor, removed, optimal_midpoint, resource_type, data_source,
  is_deleted, deleted_at, deleted_in_patch
)
SELECT
  id, uuid, name, slug, class_name, category, commodity_id, game_version_id,
  created_at, updated_at, instability, resistance, optimal_window_midpoint,
  optimal_window_randomness, optimal_window_thinness, explosion_multiplier,
  cluster_factor, removed, optimal_midpoint, resource_type, data_source,
  is_deleted, deleted_at, deleted_in_patch
FROM ptu_mineable_elements_old;

DROP TABLE ptu_mineable_elements_old;

CREATE INDEX ptu_idx_mineable_elements_category ON ptu_mineable_elements(category);
CREATE INDEX ptu_idx_mineable_elements_slug     ON ptu_mineable_elements(slug);
