-- Add crafting tracking columns to user_blueprints
-- #89: Save blueprints with names and crafted quantities
ALTER TABLE user_blueprints ADD COLUMN nickname TEXT;
ALTER TABLE user_blueprints ADD COLUMN crafted_quantity INTEGER DEFAULT 0;
ALTER TABLE user_blueprints ADD COLUMN quality_config_json TEXT;
ALTER TABLE user_blueprints ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));
