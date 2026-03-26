-- Capture image URLs seen during hangar sync imports.
-- New/unknown URLs are stored here for periodic review and potential
-- promotion to CF Images CDN. Deduped by URL.
CREATE TABLE IF NOT EXISTS image_captures (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  url         TEXT    NOT NULL,
  source      TEXT    NOT NULL DEFAULT 'hangar_sync',
  vehicle_id  INTEGER REFERENCES vehicles(id),
  vehicle_slug TEXT,
  title       TEXT,
  first_seen  TEXT    NOT NULL DEFAULT (datetime('now')),
  last_seen   TEXT    NOT NULL DEFAULT (datetime('now')),
  seen_count  INTEGER NOT NULL DEFAULT 1,
  promoted    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(url)
);
CREATE INDEX idx_image_captures_vehicle ON image_captures(vehicle_id);
CREATE INDEX idx_image_captures_promoted ON image_captures(promoted);
