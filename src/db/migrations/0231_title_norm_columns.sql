-- 0231_title_norm_columns.sql
-- Add stored title_norm columns + indexes on the three tables that
-- need fuzzy title-matching: image_captures, paints, pledge_item_media.
-- Replaces the inline REPLACE chains in admin.ts JOINs with simple
-- title_norm = title_norm equality.
--
-- The TS helper at src/lib/titleNorm.ts is the source of truth for
-- the normalisation rules. This migration backfills existing rows
-- via a chained-REPLACE approximation that matches the helper for
-- the patterns we've actually seen in production data:
--   - Lowercase
--   - Unicode dashes (em / en / minus) → hyphen
--   - " - " → " " (drop dash separators)
--   - Multi-space → single space (3 passes covers 8 consecutive spaces)
--   - Trailing " paint" / " skin" → " livery"
--
-- Going forward, all INSERTs to these tables go through TS code that
-- calls normaliseTitle() — the SQL backfill is one-shot only.
--
-- title_norm is NOT NULL with a default of '' so legacy code paths
-- that don't yet populate the column still produce valid rows; the
-- corresponding TS upserts overwrite that empty default with the
-- canonical value.

ALTER TABLE image_captures   ADD COLUMN title_norm TEXT NOT NULL DEFAULT '';
ALTER TABLE paints           ADD COLUMN title_norm TEXT NOT NULL DEFAULT '';
ALTER TABLE pledge_item_media ADD COLUMN title_norm TEXT NOT NULL DEFAULT '';

-- Backfill image_captures.title_norm from title.
UPDATE image_captures SET title_norm =
  TRIM(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      LOWER(COALESCE(title, '')),
      char(8212), '-'),  -- em dash —
      char(8211), '-'),  -- en dash –
      char(8722), '-'),  -- minus sign −
      ' - ', ' '),
      '  ', ' '),
      '  ', ' '),
      '  ', ' '),
      ' paint', ' livery'
    )
  )
;
-- One more sweep for the trailing 'skin' suffix (separate so the
-- pattern is bounded — avoids accidentally rewriting "skin" inside
-- a longer word).
UPDATE image_captures SET title_norm =
  REPLACE(title_norm || '|', ' skin|', ' livery|');
UPDATE image_captures SET title_norm = REPLACE(title_norm, '|', '')
  WHERE title_norm LIKE '%|';

-- Backfill paints.title_norm from name (paint titles use 'name', not 'title').
UPDATE paints SET title_norm =
  TRIM(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      LOWER(COALESCE(name, '')),
      char(8212), '-'),
      char(8211), '-'),
      char(8722), '-'),
      ' - ', ' '),
      '  ', ' '),
      '  ', ' '),
      '  ', ' '),
      ' paint', ' livery'
    )
  )
;
UPDATE paints SET title_norm =
  REPLACE(title_norm || '|', ' skin|', ' livery|');
UPDATE paints SET title_norm = REPLACE(title_norm, '|', '')
  WHERE title_norm LIKE '%|';

-- Backfill pledge_item_media.title_norm from title.
UPDATE pledge_item_media SET title_norm =
  TRIM(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      LOWER(COALESCE(title, '')),
      char(8212), '-'),
      char(8211), '-'),
      char(8722), '-'),
      ' - ', ' '),
      '  ', ' '),
      '  ', ' '),
      '  ', ' '),
      ' paint', ' livery'
    )
  )
;
UPDATE pledge_item_media SET title_norm =
  REPLACE(title_norm || '|', ' skin|', ' livery|');
UPDATE pledge_item_media SET title_norm = REPLACE(title_norm, '|', '')
  WHERE title_norm LIKE '%|';

-- Indexes for the JOIN paths.
CREATE INDEX idx_image_captures_title_norm   ON image_captures(title_norm);
CREATE INDEX idx_paints_title_norm           ON paints(title_norm);
CREATE INDEX idx_pledge_item_media_title_norm ON pledge_item_media(title_norm);
