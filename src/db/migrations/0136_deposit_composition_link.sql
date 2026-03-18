-- Link mining_location_deposits to rock_compositions via FK
ALTER TABLE mining_location_deposits ADD COLUMN rock_composition_id INTEGER REFERENCES rock_compositions(id);
CREATE INDEX idx_mining_location_deposits_composition ON mining_location_deposits(rock_composition_id);
