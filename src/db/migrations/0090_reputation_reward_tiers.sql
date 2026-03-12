-- Reputation reward size codes mapped to actual rep point values
-- e.g. positive_m = 2000 rep points
CREATE TABLE reputation_reward_tiers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  size_code       TEXT NOT NULL,
  direction       TEXT NOT NULL,
  rep_amount      INTEGER NOT NULL,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  UNIQUE(size_code, direction, game_version_id)
);

CREATE INDEX idx_reputation_reward_tiers_version ON reputation_reward_tiers(game_version_id);
