-- Add faction_slug for stable URL routing (not display names)
ALTER TABLE contract_generators ADD COLUMN faction_slug TEXT;

-- Populate from faction_name: "Bounty Hunters Guild" → "bountyhuntersguild"
UPDATE contract_generators SET faction_slug = LOWER(REPLACE(faction_name, ' ', ''))
WHERE faction_name IS NOT NULL AND faction_name != '';

-- Fallback: generators without faction_name use generator_key prefix
UPDATE contract_generators SET faction_slug = SUBSTR(generator_key, 1, INSTR(generator_key || '_', '_') - 1)
WHERE faction_slug IS NULL OR faction_slug = '';

CREATE INDEX idx_cg_faction_slug ON contract_generators(faction_slug, game_version_id);
