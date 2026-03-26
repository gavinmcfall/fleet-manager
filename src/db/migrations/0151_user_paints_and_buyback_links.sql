-- Rebuild user_paints for hangar sync paint ownership tracking.
-- Old table: (id, user_id, paint_id) — no pledge linkage, no buyback support.
-- New table: adds pledge info, buyback flag, synced_at. No UNIQUE constraint
-- (insert-then-swap needs coexistence; same paint can be in active + buyback).
ALTER TABLE user_paints RENAME TO user_paints_old;
CREATE TABLE user_paints (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT    NOT NULL,
    paint_id   INTEGER NOT NULL REFERENCES paints(id),
    pledge_id  TEXT,
    pledge_name TEXT,
    is_buyback INTEGER NOT NULL DEFAULT 0,
    synced_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO user_paints (id, user_id, paint_id)
  SELECT id, user_id, paint_id FROM user_paints_old;
DROP TABLE user_paints_old;
CREATE INDEX idx_user_paints_user ON user_paints(user_id);
CREATE INDEX idx_user_paints_paint ON user_paints(paint_id);

-- Add vehicle/paint/CCU linkage to buyback pledges.
ALTER TABLE user_buyback_pledges ADD COLUMN vehicle_id INTEGER REFERENCES vehicles(id);
ALTER TABLE user_buyback_pledges ADD COLUMN paint_id INTEGER REFERENCES paints(id);
ALTER TABLE user_buyback_pledges ADD COLUMN from_vehicle_id INTEGER REFERENCES vehicles(id);
ALTER TABLE user_buyback_pledges ADD COLUMN to_vehicle_id INTEGER REFERENCES vehicles(id);
ALTER TABLE user_buyback_pledges ADD COLUMN buyback_type TEXT;
