-- 0232_image_captures_manual_paint.sql
-- Admin-curated manual override for paint-capture pairing. Used when
-- automatic matching (title_norm, ship+variant SQL, pledge_item_media)
-- can't bridge a pure RSI rename divergence — e.g. pledge title
-- "C8 Pisces - 2952 Best in Show Paint" → DB row "C8 Pisces Red Alert
-- Livery". The strings genuinely don't share enough characters; the
-- admin clicks "Pick paint" in the Image Captures panel and selects
-- the canonical row from a search dropdown.
--
-- Once set, the captures filter treats the row as already-covered and
-- drops it out of the default unseen view. The mapping is durable —
-- no need to re-pick after a paint sync.

ALTER TABLE image_captures
  ADD COLUMN manual_paint_id INTEGER REFERENCES paints(id);

CREATE INDEX idx_image_captures_manual_paint_id
  ON image_captures(manual_paint_id);
