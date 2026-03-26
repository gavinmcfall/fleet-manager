-- Fix user_paints: add ON DELETE CASCADE that was lost when migration 0073
-- rebuilt the table with fewer columns than the original. The INSERT SELECT
-- from old→new failed silently because of column count mismatch, leaving
-- the pre-0073 schema (no CASCADE) in place.

ALTER TABLE user_paints RENAME TO _user_paints_old;

CREATE TABLE user_paints (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT    NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    paint_id   INTEGER NOT NULL REFERENCES paints(id),
    pledge_id  TEXT,
    pledge_name TEXT,
    is_buyback INTEGER NOT NULL DEFAULT 0,
    synced_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, paint_id)
);

INSERT INTO user_paints (id, user_id, paint_id, pledge_id, pledge_name, is_buyback, synced_at)
SELECT id, user_id, paint_id, pledge_id, pledge_name, is_buyback, synced_at
FROM _user_paints_old;

DROP TABLE _user_paints_old;
