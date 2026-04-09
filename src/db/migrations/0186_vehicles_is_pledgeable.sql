-- 0186_vehicles_is_pledgeable.sql
-- Add is_pledgeable flag to distinguish ships available on the RSI pledge store
-- from in-game-only variants (PYAM Exec, "pu-hijacked" Reclaimer, Best In Show,
-- mission-reward ships, etc.). These are still valid vehicles that can appear in
-- a player's hangar — they just can't be pledged directly.
--
-- Default is 1 (pledgeable) because the overwhelming majority of ships in the
-- table are pledgeable; the RSI ship-matrix sync flips it to 0 for anything
-- not listed on the pledge store.

ALTER TABLE vehicles ADD COLUMN is_pledgeable INTEGER NOT NULL DEFAULT 1;

-- Partial index for the common "only pledgeable ships" filter.
CREATE INDEX IF NOT EXISTS idx_vehicles_is_pledgeable ON vehicles(is_pledgeable)
  WHERE is_pledgeable = 0;
