-- 0219_4_8_new_types.sql
-- Tables for the 4 new _Type_ values surfaced in 4.8.0-PTU vs 4.7.0-LIVE:
--   CraftingQualityQuantizationRecord (38 records -- drives quality math per resource)
--   TransportCarriageAnnouncements (4 records -- alert timings + announcement strings per area)
--   TransportDestinationCategories (1 record -- global category metadata)
--   SUnifiedShakeParamsRecord (1 record -- camera shake params)
-- Each gets a base table + ptu_* shadow.

CREATE TABLE IF NOT EXISTS crafting_quality_quantization (
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

CREATE TABLE IF NOT EXISTS ptu_crafting_quality_quantization (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    resource_name TEXT NOT NULL,
    bands_json TEXT NOT NULL,
    game_version_id INTEGER REFERENCES ptu_game_versions(id),
    data_source TEXT,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    deleted_in_patch TEXT
);

CREATE TABLE IF NOT EXISTS transport_carriage_announcements (
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

CREATE TABLE IF NOT EXISTS ptu_transport_carriage_announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    area_key TEXT,
    pre_arrival_alert_time REAL,
    pre_departure_alert_time REAL,
    post_departure_alert_time REAL,
    announcements_json TEXT,
    game_version_id INTEGER REFERENCES ptu_game_versions(id),
    data_source TEXT,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    deleted_in_patch TEXT
);

CREATE TABLE IF NOT EXISTS transport_destination_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    categories_json TEXT NOT NULL,
    game_version_id INTEGER REFERENCES game_versions(id),
    data_source TEXT,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    deleted_in_patch TEXT
);

CREATE TABLE IF NOT EXISTS ptu_transport_destination_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    categories_json TEXT NOT NULL,
    game_version_id INTEGER REFERENCES ptu_game_versions(id),
    data_source TEXT,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    deleted_in_patch TEXT
);

CREATE TABLE IF NOT EXISTS unified_shake_params (
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

CREATE TABLE IF NOT EXISTS ptu_unified_shake_params (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    name TEXT,
    position_amplitude_json TEXT,
    rotation_amplitude_json TEXT,
    first_person_scale REAL,
    third_person_scale REAL,
    game_version_id INTEGER REFERENCES ptu_game_versions(id),
    data_source TEXT,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    deleted_in_patch TEXT
);
