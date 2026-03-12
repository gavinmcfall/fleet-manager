-- Align fps_ammo with other FPS tables: make game_version_id NOT NULL and
-- use UNIQUE(uuid, game_version_id) instead of UNIQUE(uuid) to support
-- multi-version data like fps_weapons, fps_armour, fps_attachments, fps_utilities.

ALTER TABLE fps_ammo RENAME TO fps_ammo_old;

CREATE TABLE fps_ammo (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid            TEXT    NOT NULL,
    name            TEXT    NOT NULL,
    slug            TEXT,
    class_name      TEXT,
    manufacturer_id INTEGER REFERENCES manufacturers(id),
    sub_type        TEXT,
    description     TEXT,
    game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
    raw_data        TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(uuid, game_version_id)
);

INSERT INTO fps_ammo
    (id, uuid, name, slug, class_name, manufacturer_id, sub_type,
     description, game_version_id, raw_data, created_at, updated_at)
SELECT id, uuid, name, slug, class_name, manufacturer_id, sub_type,
     description, game_version_id, raw_data, created_at, updated_at
FROM fps_ammo_old
WHERE game_version_id IS NOT NULL;

DROP TABLE fps_ammo_old;
