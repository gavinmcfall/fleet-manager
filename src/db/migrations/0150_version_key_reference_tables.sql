-- 0150_version_key_reference_tables.sql
-- Add game_version_id to reference tables that were missing version scoping.
-- These tables hold game data that changes between versions and need to
-- participate in the delta versioning system.
-- Requires table rebuilds because SQLite cannot ALTER UNIQUE constraints.
-- FK checks disabled during rebuild since IDs are preserved.

PRAGMA foreign_keys=OFF;

-- ============================================================
-- consumable_effect_types
-- ============================================================
CREATE TABLE consumable_effect_types_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  description TEXT,
  is_positive INTEGER DEFAULT 1,
  game_version_id INTEGER REFERENCES game_versions(id),
  UNIQUE(key, game_version_id)
);
INSERT INTO consumable_effect_types_new (id, key, name, description, is_positive, game_version_id)
  SELECT id, key, name, description, is_positive,
    (SELECT id FROM game_versions WHERE is_default = 1)
  FROM consumable_effect_types;
DROP TABLE consumable_effect_types;
ALTER TABLE consumable_effect_types_new RENAME TO consumable_effect_types;

-- ============================================================
-- paints
-- ============================================================
CREATE TABLE paints_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT,
    name TEXT NOT NULL,
    slug TEXT,
    class_name TEXT,
    description TEXT,
    image_url TEXT,
    image_url_small TEXT,
    image_url_medium TEXT,
    image_url_large TEXT,
    raw_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_base_variant INTEGER DEFAULT 0,
    game_version_id INTEGER REFERENCES game_versions(id),
    UNIQUE(class_name, game_version_id)
);
INSERT INTO paints_new (id, uuid, name, slug, class_name, description,
    image_url, image_url_small, image_url_medium, image_url_large,
    raw_data, created_at, updated_at, is_base_variant, game_version_id)
  SELECT id, uuid, name, slug, class_name, description,
    image_url, image_url_small, image_url_medium, image_url_large,
    raw_data, created_at, updated_at, is_base_variant,
    (SELECT id FROM game_versions WHERE is_default = 1)
  FROM paints;
DROP TABLE paints;
ALTER TABLE paints_new RENAME TO paints;

-- Recreate paint indexes
CREATE INDEX IF NOT EXISTS idx_paints_class_name ON paints(class_name);
CREATE INDEX IF NOT EXISTS idx_paints_slug ON paints(slug);
CREATE INDEX IF NOT EXISTS idx_paints_version ON paints(game_version_id);

-- ============================================================
-- shop_franchises
-- ============================================================
CREATE TABLE shop_franchises_new (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  localization_key  TEXT,
  slug              TEXT,
  game_version_id   INTEGER REFERENCES game_versions(id),
  UNIQUE(uuid, game_version_id)
);
INSERT INTO shop_franchises_new (id, uuid, name, localization_key, slug, game_version_id)
  SELECT id, uuid, name, localization_key, slug,
    (SELECT id FROM game_versions WHERE is_default = 1)
  FROM shop_franchises;
DROP TABLE shop_franchises;
ALTER TABLE shop_franchises_new RENAME TO shop_franchises;

PRAGMA foreign_keys=ON;
