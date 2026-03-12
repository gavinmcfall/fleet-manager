-- Final cleanup: drop stats_json from all tables now that data lives in proper columns
-- D1 supports DROP COLUMN (SQLite 3.35+)

ALTER TABLE vehicle_components DROP COLUMN stats_json;
ALTER TABLE fps_weapons DROP COLUMN stats_json;
ALTER TABLE fps_armour DROP COLUMN stats_json;
ALTER TABLE fps_helmets DROP COLUMN stats_json;
ALTER TABLE fps_attachments DROP COLUMN stats_json;
ALTER TABLE fps_utilities DROP COLUMN stats_json;
ALTER TABLE fps_clothing DROP COLUMN stats_json;
ALTER TABLE ship_missiles DROP COLUMN stats_json;
