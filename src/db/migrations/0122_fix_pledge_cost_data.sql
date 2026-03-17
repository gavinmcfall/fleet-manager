-- Fix pledge_cost values stored as bare numbers from early syncs.
-- These should be formatted as "$X.XX" strings to match the standard format.
UPDATE user_fleet SET pledge_cost = '$' || printf('%.2f', CAST(pledge_cost AS REAL))
WHERE pledge_cost IS NOT NULL AND pledge_cost NOT LIKE '$%' AND pledge_cost GLOB '[0-9]*';
