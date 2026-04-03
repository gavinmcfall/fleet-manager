-- Blueprint categories — reference table for fabricator blueprint groupings
-- 14 categories defined in DataCore (only 2 currently populated: FPSWeapons, FPSArmours)
-- Future categories include VehicleWeaponsS1-S6, Medical, FuseBattery

CREATE TABLE IF NOT EXISTS crafting_blueprint_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  game_version TEXT,
  data_source TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Link blueprints to their category
ALTER TABLE crafting_blueprints ADD COLUMN category_id INTEGER REFERENCES crafting_blueprint_categories(id);
