-- Dedupe mission_reputation_requirements.
--
-- Symptom: a single mission (e.g. slug='dataheist-unlawful-vh-stanton1')
-- had 48 rows in mission_reputation_requirements with only 2 distinct
-- (faction_slug, scope_slug, comparison, standing_slug) combinations.
-- Globally: 35,304 total rows → 1,471 unique combos, a ~24x inflation.
--
-- Cause: the extractor emits plain `INSERT INTO mission_reputation_requirements`
-- with no OR IGNORE / ON CONFLICT, and the table had no UNIQUE constraint to
-- catch duplicates. Re-running the loader accumulated rows every pass.
--
-- Fix:
-- 1. Keep one row per (mission_id, faction_slug, scope_slug, comparison,
--    standing_slug, game_version_id) — the canonical identity.
-- 2. Rebuild with a UNIQUE constraint on that tuple so future loads
--    idempotently ON CONFLICT (the extractor will need to be updated to
--    INSERT OR IGNORE / ON CONFLICT DO NOTHING, tracked separately).

CREATE TABLE mission_reputation_requirements_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id INTEGER NOT NULL REFERENCES missions(id),
  faction_slug TEXT NOT NULL,
  scope_slug TEXT NOT NULL,
  comparison TEXT NOT NULL,
  standing_slug TEXT NOT NULL,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  data_source TEXT DEFAULT 'p4k',
  is_deleted INTEGER DEFAULT 0,
  deleted_at TEXT,
  deleted_in_patch TEXT,
  UNIQUE(mission_id, faction_slug, scope_slug, comparison, standing_slug, game_version_id)
);

-- Copy the earliest row per identity tuple. MIN(id) gives us the original
-- insertion — newer duplicates are discarded.
INSERT INTO mission_reputation_requirements_new (
  id, mission_id, faction_slug, scope_slug, comparison, standing_slug,
  game_version_id, data_source, is_deleted, deleted_at, deleted_in_patch
)
SELECT MIN(id), mission_id, faction_slug, scope_slug, comparison, standing_slug,
       game_version_id,
       MIN(data_source),
       MIN(is_deleted),
       MIN(deleted_at),
       MIN(deleted_in_patch)
FROM mission_reputation_requirements
GROUP BY mission_id, faction_slug, scope_slug, comparison, standing_slug, game_version_id;

DROP TABLE mission_reputation_requirements;
ALTER TABLE mission_reputation_requirements_new RENAME TO mission_reputation_requirements;

CREATE INDEX idx_mrr_mission ON mission_reputation_requirements(mission_id);
CREATE INDEX idx_mrr_faction ON mission_reputation_requirements(faction_slug);
CREATE INDEX idx_mrr_scope   ON mission_reputation_requirements(scope_slug);
