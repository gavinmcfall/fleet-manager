-- Convert literal 'UNDEFINED' strings to NULL in loot_map.
-- These come from DataCore records where SubType has no meaningful value.
-- The load_to_d1.py script has been fixed to write NULL for future extractions.
UPDATE loot_map SET sub_type = NULL WHERE sub_type = 'UNDEFINED';
UPDATE loot_map SET type = NULL WHERE type = 'UNDEFINED';
