-- Add item rewards, completion tags, and default blueprint flag columns
-- for deeper contract reward extraction (Gap 6 enrichment)

-- Contract generator contracts: item rewards (Council Scrip, ships, unique items)
ALTER TABLE contract_generator_contracts ADD COLUMN item_rewards_json TEXT;

-- Contract generator contracts: completion tags for mission chain tracking
ALTER TABLE contract_generator_contracts ADD COLUMN completion_tags_json TEXT;

-- Crafting blueprints: flag for starter blueprints given to all players
ALTER TABLE crafting_blueprints ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;
