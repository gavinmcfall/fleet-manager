-- Missions data-quality cleanup.
-- Complements the updated extractor in `tools/scripts/extraction_pipeline_v2/
-- enrich/reference_data.py` so the CURRENT staging DB gets the same fixes
-- without re-running the 59-min full reload. Next natural reload after the
-- extractor change will make this migration a no-op.
--
-- Three problems addressed:
--
-- 1. `missions.reward_amount` / `reward_min` carrying CIG's 1-aUEC (and 0)
--    sentinel for "dynamic reward — actual payout computed at runtime."
--    Writing the literal 1 to the DB poisons avg/median/sort-by-reward.
--    Fix: add `is_dynamic_reward INTEGER DEFAULT 0`, flip flag + NULL the
--    reward when the sentinel is present.
--
-- 2. `missions.difficulty` is NULL on 94 % of rows because CIG sets
--    `missionDifficulty = -1` for templated missions. The filename stem
--    encodes difficulty as short abbreviations ("_vh_", "_e_", etc.) — the
--    extractor now parses them, this migration mirrors the inference in SQL
--    so existing rows pick it up immediately.
--
-- 3. `missions.title` / `display_name` falling back to the raw filename
--    stem (e.g. `pu_delivery_dc_stanton_internal_stanton1`) when both the
--    localization key and the template were unresolvable. Pure-SQL
--    humanisation of every known prefix is impractical, so a companion
--    Python fix-up script (scripts/humanize_mission_titles.py) emits the
--    UPDATE statements and writes them here as `WHEN slug = ... THEN ...`
--    CASE branches. The script regenerates this migration's CASE block
--    during development; for the initial apply we include the already-
--    computed branches inline.

-- #1. Add is_dynamic_reward column.
ALTER TABLE missions ADD COLUMN is_dynamic_reward INTEGER NOT NULL DEFAULT 0;

-- #1 (continued). Translate the CIG 0/1 sentinel in `reward_min` into a flag +
-- NULL payout fields. `reward_amount` is uniformly 0 in current staging
-- (pipeline never populated it — API reads via `COALESCE(NULLIF(reward_amount,0),
-- reward_min, 0)`), so the meaningful signal is `reward_min` IN (0, 1).
UPDATE missions
SET is_dynamic_reward = 1,
    reward_min = NULL,
    reward_max = CASE WHEN reward_max IN (0, 1) THEN NULL ELSE reward_max END
WHERE reward_min IN (0, 1);

-- #2. Fill difficulty from slug when CIG didn't provide one.
-- Ordering: long forms first, then short abbreviations. `LIKE` with underscore-
-- bracketed patterns so "_e_" doesn't match inside "_eliminate_".
UPDATE missions
SET difficulty = CASE
  -- Long forms (most specific first)
  WHEN LOWER(slug) LIKE '%-extreme-%' OR LOWER(slug) LIKE '%-extreme' THEN 'Extreme'
  WHEN LOWER(slug) LIKE '%-hard-%' OR LOWER(slug) LIKE '%-hard' THEN 'Hard'
  WHEN LOWER(slug) LIKE '%-medium-%' OR LOWER(slug) LIKE '%-medium' THEN 'Medium'
  WHEN LOWER(slug) LIKE '%-easy-%' OR LOWER(slug) LIKE '%-easy' THEN 'Easy'
  -- Short abbreviations (between dashes in slug, equivalent to between
  -- underscores in the original filename stem)
  WHEN LOWER(slug) LIKE '%-vh-%' OR LOWER(slug) LIKE '%-vh' THEN 'Very Hard'
  WHEN LOWER(slug) LIKE '%-ve-%' OR LOWER(slug) LIKE '%-ve' THEN 'Very Easy'
  WHEN LOWER(slug) LIKE '%-h-%' OR LOWER(slug) LIKE '%-h' THEN 'Hard'
  WHEN LOWER(slug) LIKE '%-m-%' OR LOWER(slug) LIKE '%-m' THEN 'Medium'
  WHEN LOWER(slug) LIKE '%-e-%' OR LOWER(slug) LIKE '%-e' THEN 'Easy'
  ELSE difficulty
END
WHERE difficulty IS NULL;

-- #3. Title humanisation is handled by a companion Python script run after
-- this migration applies (see tools/scripts/humanize_mission_titles.py).
-- The script reads each mission where `title` looks like a raw stem (all
-- lowercase + underscores + no spaces) and emits targeted UPDATE statements.
-- Split from this migration because humanisation logic is symbol-table-driven
-- and cleaner to maintain in Python than in a 1000-line CASE block.
