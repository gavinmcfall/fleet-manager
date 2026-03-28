-- Add unique constraints to contract generator child tables so extraction
-- scripts can upsert instead of delete-and-reinsert (reduces DB churn).
-- Uses UNIQUE INDEX approach to avoid FK constraint issues with table rebuilds.

-- contract_generator_careers: unique on (debug_name, contract_generator_id, game_version_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cgc_upsert
  ON contract_generator_careers(debug_name, contract_generator_id, game_version_id);

-- contract_generator_blueprint_pools: unique on (contract_id, pool_id, version)
-- Table already rebuilt on staging; this is a no-op if the constraint exists.
-- For fresh DBs, create the index as a fallback.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cgbp_upsert
  ON contract_generator_blueprint_pools(contract_generator_contract_id, crafting_blueprint_reward_pool_id, game_version_id);
