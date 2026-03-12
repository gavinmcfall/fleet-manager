-- Drop stats_json from the remaining 3 tables now that data lives in proper columns.
-- consumables.stats_json was always NULL (never populated by extraction scripts).
-- mineable_elements.stats_json → 7 typed columns (migration 0097).
-- law_infractions.stats_json → 16 typed columns (migration 0098).

ALTER TABLE consumables DROP COLUMN stats_json;
ALTER TABLE mineable_elements DROP COLUMN stats_json;
ALTER TABLE law_infractions DROP COLUMN stats_json;
