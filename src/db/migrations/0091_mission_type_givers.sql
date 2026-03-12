-- Junction table: which mission givers offer which mission types
CREATE TABLE mission_type_givers (
  mission_type_id  INTEGER NOT NULL REFERENCES mission_types(id),
  mission_giver_id INTEGER NOT NULL REFERENCES mission_givers(id),
  PRIMARY KEY (mission_type_id, mission_giver_id)
);
