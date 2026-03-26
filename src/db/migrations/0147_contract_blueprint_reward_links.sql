-- 0147_contract_blueprint_reward_links.sql
-- Links contract generators to blueprint reward pools.
-- Enables both directions:
--   Blueprint → which missions drop it (and % chance)
--   Mission → which blueprints it can drop
--
-- contract_generator_key matches the generator filename (e.g. "intersec_patrol")
-- which maps to contracts via naming convention in the contracts table.
-- chance is the probability the pool is rolled on mission success (1.0, 0.75, or 0.25).
-- Actual per-blueprint drop rate = chance × (1 / pool_size).

CREATE TABLE contract_blueprint_reward_pools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_generator_key TEXT NOT NULL,
    crafting_blueprint_reward_pool_id INTEGER NOT NULL REFERENCES crafting_blueprint_reward_pools(id),
    chance REAL NOT NULL DEFAULT 1.0,
    game_version_id INTEGER REFERENCES game_versions(id)
);
CREATE INDEX idx_contract_bp_pools_generator ON contract_blueprint_reward_pools(contract_generator_key);
CREATE INDEX idx_contract_bp_pools_pool ON contract_blueprint_reward_pools(crafting_blueprint_reward_pool_id);
CREATE INDEX idx_contract_bp_pools_version ON contract_blueprint_reward_pools(game_version_id);
