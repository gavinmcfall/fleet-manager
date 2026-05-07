-- 0220_fix_ptu_game_versions_fk.sql
-- Fix migration 0219 — the 4 ptu_* tables incorrectly referenced ptu_game_versions(id),
-- which doesn't exist (no ptu_game_versions table was created in 0215; both LIVE and PTU
-- channels share the single game_versions table). Drop the 4 broken ptu_* tables and
-- recreate with the correct FK target.

DROP TABLE IF EXISTS ptu_crafting_quality_quantization;
DROP TABLE IF EXISTS ptu_transport_carriage_announcements;
DROP TABLE IF EXISTS ptu_transport_destination_categories;
DROP TABLE IF EXISTS ptu_unified_shake_params;

CREATE TABLE ptu_crafting_quality_quantization (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    resource_name TEXT NOT NULL,
    bands_json TEXT NOT NULL,
    game_version_id INTEGER REFERENCES game_versions(id),
    data_source TEXT,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    deleted_in_patch TEXT
);

CREATE TABLE ptu_transport_carriage_announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    area_key TEXT,
    pre_arrival_alert_time REAL,
    pre_departure_alert_time REAL,
    post_departure_alert_time REAL,
    announcements_json TEXT,
    game_version_id INTEGER REFERENCES game_versions(id),
    data_source TEXT,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    deleted_in_patch TEXT
);

CREATE TABLE ptu_transport_destination_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    categories_json TEXT NOT NULL,
    game_version_id INTEGER REFERENCES game_versions(id),
    data_source TEXT,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    deleted_in_patch TEXT
);

CREATE TABLE ptu_unified_shake_params (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    name TEXT,
    position_amplitude_json TEXT,
    rotation_amplitude_json TEXT,
    first_person_scale REAL,
    third_person_scale REAL,
    game_version_id INTEGER REFERENCES game_versions(id),
    data_source TEXT,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    deleted_in_patch TEXT
);
