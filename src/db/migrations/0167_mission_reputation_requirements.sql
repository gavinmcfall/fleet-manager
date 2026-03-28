-- Reputation requirements for mission availability (faction standing gates)
CREATE TABLE mission_reputation_requirements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id INTEGER NOT NULL REFERENCES missions(id),
  faction_slug TEXT NOT NULL,
  scope_slug TEXT NOT NULL,
  comparison TEXT NOT NULL,
  standing_slug TEXT NOT NULL,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id)
);

CREATE INDEX idx_mrr_mission ON mission_reputation_requirements(mission_id);
CREATE INDEX idx_mrr_faction ON mission_reputation_requirements(faction_slug, game_version_id);
CREATE INDEX idx_mrr_scope ON mission_reputation_requirements(scope_slug, game_version_id);
