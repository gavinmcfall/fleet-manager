-- Contract generator system — dynamic mission templates with blueprint reward pools
-- Replaces the flat contract_blueprint_reward_pools linkage with full mission structure

CREATE TABLE contract_generators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  generator_key TEXT NOT NULL,
  display_name TEXT,
  faction_name TEXT,
  guild TEXT,
  mission_type TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  UNIQUE(generator_key, game_version_id)
);

CREATE TABLE contract_generator_careers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_generator_id INTEGER NOT NULL REFERENCES contract_generators(id),
  debug_name TEXT NOT NULL,
  system TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id)
);

CREATE TABLE contract_generator_contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  career_id INTEGER NOT NULL REFERENCES contract_generator_careers(id),
  uuid TEXT NOT NULL,
  debug_name TEXT NOT NULL,
  difficulty TEXT,
  template TEXT,
  min_standing TEXT,
  max_standing TEXT,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  UNIQUE(uuid, game_version_id)
);

CREATE TABLE contract_generator_blueprint_pools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_generator_contract_id INTEGER NOT NULL REFERENCES contract_generator_contracts(id),
  crafting_blueprint_reward_pool_id INTEGER NOT NULL REFERENCES crafting_blueprint_reward_pools(id),
  chance REAL DEFAULT 1.0,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id)
);

CREATE INDEX idx_cg_generator_key ON contract_generators(generator_key);
CREATE INDEX idx_cgc_career_id ON contract_generator_contracts(career_id);
CREATE INDEX idx_cgbp_contract_id ON contract_generator_blueprint_pools(contract_generator_contract_id);
