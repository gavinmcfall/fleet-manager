-- 0230_pledge_item_media.sql
-- Canonical CF-hosted image per pledge-item title. Powers the
-- title-fallback JOIN on /api/hangar so non-ship items the extension
-- failed to scrape (Self-Land Hangar, Geist Armor Core Epoque, etc.)
-- still render with a meaningful image instead of <ImageOff>.
--
-- One row per (lowercased) title. Admins promote captured URLs to CF
-- Images via the expanded admin Media Library UI; the resulting
-- cf_image_id + cf_image_url land here.
--
-- Title is the key (not a vehicle FK) because these items don't have
-- vehicle rows — they're loose pledge SKUs (decorations, FPS gear,
-- etc.). LOWER(title) UNIQUE keeps it case-insensitive without
-- needing collation.

CREATE TABLE pledge_item_media (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  title             TEXT    NOT NULL,
  title_lower       TEXT    NOT NULL,
  cf_image_id       TEXT    NOT NULL,
  cf_image_url      TEXT    NOT NULL,
  source_capture_id INTEGER REFERENCES image_captures(id),
  uploaded_by       TEXT    REFERENCES user(id) ON DELETE SET NULL,
  uploaded_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  notes             TEXT
);

CREATE UNIQUE INDEX idx_pledge_item_media_title_lower
  ON pledge_item_media(title_lower);
