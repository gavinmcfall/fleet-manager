-- Add standings_id and standing_id columns to companion_reputation_scores
-- for cross-referencing with reputation_scopes and reputation_standings tables.

ALTER TABLE companion_reputation_scores ADD COLUMN standings_id TEXT;
ALTER TABLE companion_reputation_scores ADD COLUMN standing_id TEXT;
