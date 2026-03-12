-- Add ON DELETE CASCADE to user_id FK on 7 user-owned tables.
-- SQLite requires table rebuild to change FK constraints.
-- Each table: rename → recreate with CASCADE → copy data → drop old → recreate indexes.

-- ============================================================
-- 1. user_fleet
-- ============================================================
ALTER TABLE user_fleet RENAME TO user_fleet_old;

CREATE TABLE user_fleet (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    vehicle_id        INTEGER NOT NULL REFERENCES vehicles(id),
    insurance_type_id INTEGER REFERENCES insurance_types(id),
    warbond           BOOLEAN NOT NULL DEFAULT FALSE,
    is_loaner         BOOLEAN NOT NULL DEFAULT FALSE,
    pledge_id         TEXT,
    pledge_name       TEXT,
    pledge_cost       TEXT,
    pledge_date       TEXT,
    custom_name       TEXT,
    equipped_paint_id INTEGER REFERENCES paints(id),
    imported_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    org_visibility    TEXT    NOT NULL DEFAULT 'private',
    available_for_ops INTEGER NOT NULL DEFAULT 0
);

INSERT INTO user_fleet SELECT * FROM user_fleet_old;
DROP TABLE user_fleet_old;

CREATE INDEX IF NOT EXISTS idx_user_fleet_user_id    ON user_fleet(user_id);
CREATE INDEX IF NOT EXISTS idx_user_fleet_vehicle_id ON user_fleet(vehicle_id);

-- ============================================================
-- 2. user_paints
-- ============================================================
ALTER TABLE user_paints RENAME TO user_paints_old;

CREATE TABLE user_paints (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    paint_id INTEGER NOT NULL REFERENCES paints(id),
    UNIQUE(user_id, paint_id)
);

INSERT INTO user_paints SELECT * FROM user_paints_old;
DROP TABLE user_paints_old;

-- ============================================================
-- 3. user_llm_configs
-- ============================================================
ALTER TABLE user_llm_configs RENAME TO user_llm_configs_old;

CREATE TABLE user_llm_configs (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    provider          TEXT    NOT NULL,
    encrypted_api_key TEXT    NOT NULL,
    model             TEXT,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider)
);

INSERT INTO user_llm_configs SELECT * FROM user_llm_configs_old;
DROP TABLE user_llm_configs_old;

-- ============================================================
-- 4. user_settings
-- ============================================================
ALTER TABLE user_settings RENAME TO user_settings_old;

CREATE TABLE user_settings (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    key     TEXT    NOT NULL,
    value   TEXT    NOT NULL,
    UNIQUE(user_id, key)
);

INSERT INTO user_settings SELECT * FROM user_settings_old;
DROP TABLE user_settings_old;

-- ============================================================
-- 5. ai_analyses
-- ============================================================
ALTER TABLE ai_analyses RENAME TO ai_analyses_old;

CREATE TABLE ai_analyses (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    provider      TEXT    NOT NULL,
    model         TEXT    NOT NULL,
    vehicle_count INTEGER NOT NULL,
    analysis      TEXT    NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ai_analyses SELECT * FROM ai_analyses_old;
DROP TABLE ai_analyses_old;

-- ============================================================
-- 6. user_loot_collection
-- ============================================================
ALTER TABLE user_loot_collection RENAME TO user_loot_collection_old;

CREATE TABLE user_loot_collection (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    loot_map_id  INTEGER NOT NULL REFERENCES loot_map(id),
    collected_at TEXT    DEFAULT (datetime('now')),
    quantity     INTEGER NOT NULL DEFAULT 1,
    UNIQUE(user_id, loot_map_id)
);

INSERT INTO user_loot_collection SELECT * FROM user_loot_collection_old;
DROP TABLE user_loot_collection_old;

CREATE INDEX idx_user_loot_collection_user ON user_loot_collection(user_id);
CREATE INDEX idx_user_loot_collection_item ON user_loot_collection(loot_map_id);

-- ============================================================
-- 7. user_loot_wishlist
-- ============================================================
ALTER TABLE user_loot_wishlist RENAME TO user_loot_wishlist_old;

CREATE TABLE user_loot_wishlist (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    loot_map_id INTEGER NOT NULL REFERENCES loot_map(id),
    added_at    TEXT    DEFAULT (datetime('now')),
    quantity    INTEGER NOT NULL DEFAULT 1,
    UNIQUE(user_id, loot_map_id)
);

INSERT INTO user_loot_wishlist SELECT * FROM user_loot_wishlist_old;
DROP TABLE user_loot_wishlist_old;

CREATE INDEX idx_user_loot_wishlist_user ON user_loot_wishlist(user_id);
CREATE INDEX idx_user_loot_wishlist_item ON user_loot_wishlist(loot_map_id);
