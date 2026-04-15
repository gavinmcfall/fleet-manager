-- 0210_drop_missions_lawful_legacy_col.sql
--
-- Drop missions.lawful. The canonical column is is_lawful (added in an
-- earlier migration and read by Missions.jsx, Contracts.jsx, MissionDetail.jsx).
-- Previously gamedata.ts used COALESCE(m.is_lawful, m.lawful, 0) to bridge old
-- extractor writes of `lawful` to the canonical column. The v2 extractor
-- now writes is_lawful directly (commit 5de393a, reference_data.py). The
-- gamedata.ts COALESCE has been removed to reference is_lawful only.
--
-- See reference_duplicate_columns_coalesce_pattern.md — classic schema drift
-- where extractor wrote the wrong name. Resolved now.

ALTER TABLE missions DROP COLUMN lawful;
