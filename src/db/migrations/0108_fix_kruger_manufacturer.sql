-- Fix Kruger manufacturer data issues:
-- 1. ID 441 has misspelling "Kruger Intergalatic" → "Kruger Intergalactic"
-- 2. ID 440 has the full description stored as the name field — reassign its vehicles to 441 and delete it

-- Fix the misspelling on the correct entry
UPDATE manufacturers SET name = 'Kruger Intergalactic'
WHERE id = 441 AND name LIKE '%Kruger Intergalat%';

-- Reassign any vehicles pointing to the description-as-name entry (440) to the correct one (441)
UPDATE vehicles SET manufacturer_id = 441
WHERE manufacturer_id = 440;

-- Delete the broken entry
DELETE FROM manufacturers WHERE id = 440;
