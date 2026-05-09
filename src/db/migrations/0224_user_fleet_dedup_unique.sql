-- 0224_user_fleet_dedup_unique.sql
-- Prevent duplicate user_fleet rows on re-import.
--
-- The original insert-then-swap pattern (record MAX(id), insert new
-- rows, delete <= max) allowed dupes when concurrent imports collided
-- or when the swap step failed silently. Staging accumulated 633 dup
-- rows for one user (1542 → 909 after one-shot DELETE on 2026-05-08).
-- Production was clean at this writing but had no DB-level guarantee.
--
-- Partial unique index on (user_id, pledge_id, vehicle_id) — partial
-- because legacy rows can have pledge_id NULL (unmatched ships, manual
-- entries) and SQLite UNIQUE treats multiple NULLs as not-equal anyway.
-- The partial WHERE is explicit so the intent is documented in schema.
--
-- Paired with the executeFleetSwap refactor in src/lib/fleet-import.ts
-- and src/routes/import.ts: INSERTs now ON CONFLICT DO UPDATE, and the
-- swap step deletes by imported_at < this-import's-timestamp instead of
-- by id <= max.

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_fleet_user_pledge_vehicle
  ON user_fleet(user_id, pledge_id, vehicle_id)
  WHERE pledge_id IS NOT NULL;
