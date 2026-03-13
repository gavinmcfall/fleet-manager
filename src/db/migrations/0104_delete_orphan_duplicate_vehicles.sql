-- Remove ~180 orphan duplicate vehicles with NULL manufacturer_id.
-- These have manufacturer-prefixed slugs (e.g. aegs-gladius, anvl-carrack)
-- duplicating the real entries (gladius, carrack) which have manufacturer_id set.
--
-- On staging: no user_fleet references, safe to delete directly.
-- On production: 410 user_fleet rows across 7 users reference these orphans.
-- We remap those fleet rows to the real vehicle (matched by name) before deleting.

PRAGMA foreign_keys=OFF;

-- Step 1: Remap user_fleet rows from orphan vehicle_id to the real vehicle_id.
-- Only remap where a matching real vehicle exists (by name, with manufacturer_id set).
-- If multiple orphans share the same name, they all remap to the same real vehicle.
UPDATE user_fleet
SET vehicle_id = (
    SELECT real.id
    FROM vehicles AS real
    WHERE real.name = (SELECT orphan.name FROM vehicles AS orphan WHERE orphan.id = user_fleet.vehicle_id)
      AND real.manufacturer_id IS NOT NULL
    LIMIT 1
)
WHERE vehicle_id IN (SELECT id FROM vehicles WHERE manufacturer_id IS NULL)
  AND EXISTS (
    SELECT 1
    FROM vehicles AS real
    WHERE real.name = (SELECT orphan.name FROM vehicles AS orphan WHERE orphan.id = user_fleet.vehicle_id)
      AND real.manufacturer_id IS NOT NULL
);

-- Step 2: Delete orphan vehicle_images (these are all empty/placeholder rows).
-- Only delete for orphans that have a matching real vehicle (so we don't orphan fleet rows).
DELETE FROM vehicle_images
WHERE vehicle_id IN (
    SELECT orphan.id
    FROM vehicles AS orphan
    WHERE orphan.manufacturer_id IS NULL
      AND EXISTS (
        SELECT 1 FROM vehicles AS real
        WHERE real.name = orphan.name
          AND real.manufacturer_id IS NOT NULL
      )
);

-- Step 3: Delete the orphan vehicles themselves.
-- Only delete orphans that have a matching real vehicle by name.
-- Any orphan without a match is left alone (safety net).
DELETE FROM vehicles
WHERE manufacturer_id IS NULL
  AND EXISTS (
    SELECT 1 FROM vehicles AS real
    WHERE real.name = vehicles.name
      AND real.manufacturer_id IS NOT NULL
  );
