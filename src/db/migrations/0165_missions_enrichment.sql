-- Enrich missions with reputation failure/abandon, time limits, player caps, and location data
ALTER TABLE missions ADD COLUMN rep_fail_summary TEXT;
ALTER TABLE missions ADD COLUMN rep_abandon_summary TEXT;
ALTER TABLE missions ADD COLUMN time_limit_minutes INTEGER;
ALTER TABLE missions ADD COLUMN max_players INTEGER;
ALTER TABLE missions ADD COLUMN can_share INTEGER DEFAULT 1;
ALTER TABLE missions ADD COLUMN once_only INTEGER DEFAULT 0;
ALTER TABLE missions ADD COLUMN fail_if_criminal INTEGER;
ALTER TABLE missions ADD COLUMN available_in_prison INTEGER DEFAULT 0;
ALTER TABLE missions ADD COLUMN wanted_level_min INTEGER DEFAULT 0;
ALTER TABLE missions ADD COLUMN wanted_level_max INTEGER DEFAULT 5;
ALTER TABLE missions ADD COLUMN buy_in_amount INTEGER DEFAULT 0;
ALTER TABLE missions ADD COLUMN reward_max INTEGER;
ALTER TABLE missions ADD COLUMN has_standing_bonus INTEGER DEFAULT 0;
ALTER TABLE missions ADD COLUMN location_ref TEXT;
ALTER TABLE missions ADD COLUMN locality TEXT;
