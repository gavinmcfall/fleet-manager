-- Add reputation reward columns to contract generator contracts
ALTER TABLE contract_generator_contracts ADD COLUMN rep_reward INTEGER;
ALTER TABLE contract_generator_contracts ADD COLUMN rep_rewards_json TEXT;
