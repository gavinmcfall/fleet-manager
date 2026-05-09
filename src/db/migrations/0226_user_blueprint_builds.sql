-- 0226_user_blueprint_builds.sql
-- Multi-build support for user_blueprints.
--
-- Today: user_blueprints has UNIQUE(user_id, blueprint_uuid) — one row
-- per (user, BP). Saving a Quality Sim config UPSERTs the row, so a
-- "Bang bang Bow" custom build overwrites the bare "I own this" entry.
--
-- New design: ownership/wishlist stays one-row-per-BP. Builds (named
-- saved configurations) live in a child table — many builds per BP per
-- user. Each build has a name, the slot quality config, and an
-- optional crafted_quantity tracker scoped to that build.
--
-- Backfill: any user_blueprints row that has quality_config_json
-- migrates that config out into a new build named after the row's
-- nickname (or "Default Build" if no nickname). The user_blueprints
-- columns nickname/quality_config_json/crafted_quantity stay
-- (deprecated but preserved) so older clients keep working until the
-- frontend is updated.

CREATE TABLE user_blueprint_builds (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id              TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    blueprint_uuid       TEXT    NOT NULL,
    name                 TEXT    NOT NULL,
    quality_config_json  TEXT    NOT NULL,
    crafted_quantity     INTEGER NOT NULL DEFAULT 0,
    notes                TEXT,
    created_at           TEXT    DEFAULT (datetime('now')),
    updated_at           TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX idx_user_blueprint_builds_user
  ON user_blueprint_builds(user_id);
CREATE INDEX idx_user_blueprint_builds_uuid
  ON user_blueprint_builds(blueprint_uuid);
CREATE UNIQUE INDEX idx_user_blueprint_builds_unique
  ON user_blueprint_builds(user_id, blueprint_uuid, name);

-- Backfill: existing user_blueprints rows that have a quality_config
-- become standalone builds. Use the row's nickname as the build name,
-- falling back to "Default Build" when nickname is null/empty.
INSERT INTO user_blueprint_builds
  (user_id, blueprint_uuid, name, quality_config_json, crafted_quantity, created_at, updated_at)
SELECT
  ub.user_id,
  ub.blueprint_uuid,
  COALESCE(NULLIF(TRIM(ub.nickname), ''), 'Default Build') AS name,
  ub.quality_config_json,
  COALESCE(ub.crafted_quantity, 0) AS crafted_quantity,
  ub.updated_at,
  ub.updated_at
FROM user_blueprints ub
WHERE ub.quality_config_json IS NOT NULL
  AND ub.blueprint_uuid IS NOT NULL;
