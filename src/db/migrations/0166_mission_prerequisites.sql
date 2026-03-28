-- Mission prerequisite chains — which missions must be completed before unlocking another
CREATE TABLE mission_prerequisites (
  mission_id INTEGER NOT NULL REFERENCES missions(id),
  required_mission_id INTEGER NOT NULL REFERENCES missions(id),
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  PRIMARY KEY (mission_id, required_mission_id, game_version_id)
);

CREATE INDEX idx_mp_required ON mission_prerequisites(required_mission_id);
