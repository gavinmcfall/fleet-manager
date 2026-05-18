-- 0242_mission_rep_changes.sql
-- PART K K3: structured rep gain/loss per mission per scope per event.
--
-- Replaces the opaque rep_fail_summary / rep_abandon_summary TEXT columns on
-- missions (formats like "security: -XXS, affinity: -S") with structured rows
-- the UI can render as colored badges + tooltips. The summary cols stay on
-- missions for backward compat — they're the parser input.
--
-- rep_amount is resolved by the extractor by JOINing parsed (size_code, direction)
-- pairs against reputation_reward_tiers (mig 0090). When the tier lookup misses,
-- rep_amount stays NULL and the UI just shows the size code without a number.

CREATE TABLE mission_rep_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id INTEGER NOT NULL REFERENCES missions(id),
  scope_slug TEXT NOT NULL,              -- 'security', 'affinity', etc.
  event TEXT NOT NULL,                   -- 'fail' | 'abandon' (success added when CIG ships a summary for it)
  size_code TEXT NOT NULL,               -- 'XXS' | 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'
  direction TEXT NOT NULL,               -- 'positive' | 'negative'
  rep_amount INTEGER,                    -- resolved from reputation_reward_tiers; nullable
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  data_source TEXT,
  UNIQUE(mission_id, scope_slug, event, game_version_id)
);

CREATE INDEX idx_mission_rep_changes_mission ON mission_rep_changes(mission_id);
CREATE INDEX idx_mission_rep_changes_scope ON mission_rep_changes(scope_slug);
