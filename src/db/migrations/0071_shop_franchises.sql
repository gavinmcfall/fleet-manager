-- Shop franchises reference table and enriched shop columns.
-- Franchise data comes from DataCore/libs/foundry/records/franchises/*.json.
-- Display names are resolved from localization (global.ini).

-- Franchise reference table (game-version-independent, UUIDs are stable)
CREATE TABLE shop_franchises (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL UNIQUE,
  name              TEXT    NOT NULL,
  localization_key  TEXT,
  slug              TEXT
);
CREATE INDEX idx_shop_franchises_slug ON shop_franchises(slug);

-- Enrich shops with franchise data
ALTER TABLE shops ADD COLUMN franchise_uuid TEXT;
ALTER TABLE shops ADD COLUMN display_name TEXT;
ALTER TABLE shops ADD COLUMN inventory_type TEXT;
CREATE INDEX idx_shops_franchise ON shops(franchise_uuid);
CREATE INDEX idx_shops_display_name ON shops(display_name);
