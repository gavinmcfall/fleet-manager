-- Reputation perks unlocked at specific standing tiers
CREATE TABLE reputation_perks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  scope_id          INTEGER NOT NULL REFERENCES reputation_scopes(id),
  standing_id       INTEGER NOT NULL REFERENCES reputation_standings(id),
  perk_name         TEXT NOT NULL,
  display_name      TEXT,
  description       TEXT,
  reward_item_uuid  TEXT,
  reward_item_name  TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  UNIQUE(scope_id, standing_id, perk_name, game_version_id)
);

CREATE INDEX idx_reputation_perks_scope ON reputation_perks(scope_id);
CREATE INDEX idx_reputation_perks_version ON reputation_perks(game_version_id);
