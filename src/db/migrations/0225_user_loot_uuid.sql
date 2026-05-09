-- 0225_user_loot_uuid.sql
-- Make user_loot_collection and user_loot_wishlist channel-stable.
--
-- Original schema FK'd loot_map_id → loot_map(id). D1 enforces FK
-- violations as 500s, so when a PTU-only item (e.g. Novia Crossbow,
-- present in ptu_loot_map but absent from LIVE loot_map) gets queued
-- by the cross-channel mutation route, the INSERT explodes:
--
--   POST /api/loot/wishlist/<ptu-only-uuid>
--   → resolveLootMapId returns {id: <ptu_id>, channel: 'ptu'}
--   → INSERT INTO user_loot_wishlist (loot_map_id) VALUES (<ptu_id>)
--   → SQLITE_CONSTRAINT (loot_map(id) doesn't have that id)
--   → 500 Internal Server Error to the user
--
-- Fix: store the channel-stable uuid as the primary identifier. Keep
-- loot_map_id nullable (best-effort cache for joins) but no longer FK'd.
-- GET queries can JOIN against whichever channel's loot_map by uuid.
--
-- SQLite doesn't support DROP CONSTRAINT, so we recreate the tables
-- via the standard create-copy-drop-rename dance.

-- ─── user_loot_collection ─────────────────────────────────────────

CREATE TABLE user_loot_collection_new (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    loot_map_id  INTEGER,                    -- nullable, advisory only
    loot_uuid    TEXT    NOT NULL,
    collected_at TEXT    DEFAULT (datetime('now')),
    quantity     INTEGER NOT NULL DEFAULT 1
);

INSERT INTO user_loot_collection_new (id, user_id, loot_map_id, loot_uuid, collected_at, quantity)
SELECT ulc.id, ulc.user_id, ulc.loot_map_id, lm.uuid, ulc.collected_at, ulc.quantity
FROM user_loot_collection ulc
JOIN loot_map lm ON lm.id = ulc.loot_map_id;

DROP TABLE user_loot_collection;
ALTER TABLE user_loot_collection_new RENAME TO user_loot_collection;

CREATE INDEX idx_user_loot_collection_user ON user_loot_collection(user_id);
CREATE INDEX idx_user_loot_collection_uuid ON user_loot_collection(loot_uuid);
CREATE UNIQUE INDEX idx_user_loot_collection_user_uuid
  ON user_loot_collection(user_id, loot_uuid);

-- ─── user_loot_wishlist ───────────────────────────────────────────

CREATE TABLE user_loot_wishlist_new (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    loot_map_id INTEGER,
    loot_uuid   TEXT    NOT NULL,
    added_at    TEXT    DEFAULT (datetime('now')),
    quantity    INTEGER NOT NULL DEFAULT 1
);

INSERT INTO user_loot_wishlist_new (id, user_id, loot_map_id, loot_uuid, added_at, quantity)
SELECT ulw.id, ulw.user_id, ulw.loot_map_id, lm.uuid, ulw.added_at, ulw.quantity
FROM user_loot_wishlist ulw
JOIN loot_map lm ON lm.id = ulw.loot_map_id;

DROP TABLE user_loot_wishlist;
ALTER TABLE user_loot_wishlist_new RENAME TO user_loot_wishlist;

CREATE INDEX idx_user_loot_wishlist_user ON user_loot_wishlist(user_id);
CREATE INDEX idx_user_loot_wishlist_uuid ON user_loot_wishlist(loot_uuid);
CREATE UNIQUE INDEX idx_user_loot_wishlist_user_uuid
  ON user_loot_wishlist(user_id, loot_uuid);
