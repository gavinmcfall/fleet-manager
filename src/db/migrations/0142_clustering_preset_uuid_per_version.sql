-- 0142_clustering_preset_uuid_per_version.sql
--
-- Fix mining_clustering_presets UNIQUE constraint on uuid.
-- The uuid is only unique within a game version, not globally —
-- the same clustering preset appears across multiple game versions.
-- Change from UNIQUE(uuid) to UNIQUE(uuid, game_version_id).

CREATE TABLE mining_clustering_presets_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL,
    name TEXT NOT NULL,
    probability_of_clustering REAL NOT NULL DEFAULT 0,
    game_version_id INTEGER REFERENCES game_versions(id),
    UNIQUE(uuid, game_version_id)
);

INSERT INTO mining_clustering_presets_new (id, uuid, name, probability_of_clustering, game_version_id)
SELECT id, uuid, name, probability_of_clustering, game_version_id
FROM mining_clustering_presets;

DROP TABLE mining_clustering_presets;
ALTER TABLE mining_clustering_presets_new RENAME TO mining_clustering_presets;
