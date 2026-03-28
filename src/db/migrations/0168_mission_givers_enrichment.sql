-- Enrich mission givers with biography, occupation, affiliation, and portrait data
ALTER TABLE mission_givers ADD COLUMN biography TEXT;
ALTER TABLE mission_givers ADD COLUMN occupation TEXT;
ALTER TABLE mission_givers ADD COLUMN association TEXT;
ALTER TABLE mission_givers ADD COLUMN headquarters TEXT;
ALTER TABLE mission_givers ADD COLUMN portrait_url TEXT;
ALTER TABLE mission_givers ADD COLUMN is_lawful INTEGER;
ALTER TABLE mission_givers ADD COLUMN allies_json TEXT;
ALTER TABLE mission_givers ADD COLUMN enemies_json TEXT;
