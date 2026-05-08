-- 0223_user_blueprints_owned_wishlist.sql
-- Add Owned + Wishlist tracking to user_blueprints.
--
-- The existing row contract (one row per (user, blueprint)) already implied
-- ownership, but there was no way to mark "I want this someday" without
-- pretending to own it. Splitting into two flags keeps both intents
-- separable and lets the desktop companion app (when it lands) populate
-- is_owned automatically from log scrapes while leaving wishlist purely
-- user-driven.
--
-- We also introduce blueprint_uuid as the channel-stable identifier.
-- crafting_blueprint_id stays for backwards compatibility (existing
-- quality-sim saves use it), but new flows key on uuid so users on PTU
-- can mark blueprints that exist only in ptu_crafting_blueprints
-- (different autoincrement id space) as owned/wishlist.

ALTER TABLE user_blueprints ADD COLUMN blueprint_uuid TEXT;
ALTER TABLE user_blueprints ADD COLUMN is_owned INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_blueprints ADD COLUMN is_wishlist INTEGER NOT NULL DEFAULT 0;

-- Backfill blueprint_uuid for existing rows from the FK join.
UPDATE user_blueprints
SET blueprint_uuid = (
  SELECT cb.uuid FROM crafting_blueprints cb
  WHERE cb.id = user_blueprints.crafting_blueprint_id
)
WHERE blueprint_uuid IS NULL AND crafting_blueprint_id IS NOT NULL;

-- New writes prefer this index. NULL uuids skipped (NULLs are not equal in
-- SQLite UNIQUE indexes), so legacy rows without uuid don't conflict.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_blueprints_user_uuid
  ON user_blueprints(user_id, blueprint_uuid);

CREATE INDEX IF NOT EXISTS idx_user_blueprints_owned
  ON user_blueprints(user_id, is_owned) WHERE is_owned = 1;
CREATE INDEX IF NOT EXISTS idx_user_blueprints_wishlist
  ON user_blueprints(user_id, is_wishlist) WHERE is_wishlist = 1;
