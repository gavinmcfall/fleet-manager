-- New table for the full mission pool (2,559 pu_missions)
-- Distinct from contracts (curated NPC chains)
CREATE TABLE missions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                  TEXT NOT NULL,
  title                 TEXT,
  display_name          TEXT,
  description           TEXT,
  mission_type_id       INTEGER REFERENCES mission_types(id),
  mission_giver_id      INTEGER REFERENCES mission_givers(id),
  reward_amount         INTEGER DEFAULT 0,
  reward_currency       TEXT DEFAULT 'aUEC',
  reputation_scope_id   INTEGER REFERENCES reputation_scopes(id),
  reputation_reward_size TEXT,
  min_reputation        INTEGER,
  is_lawful             INTEGER,
  not_for_release       INTEGER DEFAULT 0,
  location_hint         TEXT,
  category              TEXT,
  subcategory           TEXT,
  difficulty            TEXT,
  game_version_id       INTEGER NOT NULL REFERENCES game_versions(id),
  UNIQUE(uuid, game_version_id)
);

CREATE INDEX idx_missions_type ON missions(mission_type_id);
CREATE INDEX idx_missions_giver ON missions(mission_giver_id);
CREATE INDEX idx_missions_category ON missions(category);
CREATE INDEX idx_missions_reputation ON missions(reputation_scope_id);
CREATE INDEX idx_missions_version ON missions(game_version_id);
