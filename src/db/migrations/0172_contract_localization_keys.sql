-- Add localization key columns to contract generator contracts.
-- These map contract instances to their global.ini Title/Description string keys,
-- enabling the blueprint pools enhancement to append text to the right strings.

ALTER TABLE contract_generator_contracts ADD COLUMN title_loc_key TEXT;
ALTER TABLE contract_generator_contracts ADD COLUMN desc_loc_key TEXT;

CREATE INDEX idx_cgc_desc_loc_key ON contract_generator_contracts(desc_loc_key);
