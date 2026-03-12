-- Version-key damage_types
-- Small reference table (6 types) that may change across game versions
-- as CIG adds or renames damage categories.

ALTER TABLE damage_types RENAME TO damage_types_old;

CREATE TABLE damage_types (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  slug            TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  UNIQUE(uuid, game_version_id)
);

INSERT INTO damage_types (id, uuid, name, slug, game_version_id)
SELECT id, uuid, name, slug,
       (SELECT id FROM game_versions WHERE is_default = 1 LIMIT 1)
FROM damage_types_old;

DROP TABLE damage_types_old;
