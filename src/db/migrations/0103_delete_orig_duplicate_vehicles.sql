-- Remove duplicate vehicles with "orig-" prefix slugs.
-- These are Origin Jumpworks ships that were extracted with manufacturer
-- prefix, duplicating the real entries (100i, 300i, 400i, etc.)
-- They have no user_fleet references, no images, and null stats.

DELETE FROM vehicle_images WHERE vehicle_id IN (SELECT id FROM vehicles WHERE slug LIKE 'orig-%');
DELETE FROM vehicles WHERE slug LIKE 'orig-%';
