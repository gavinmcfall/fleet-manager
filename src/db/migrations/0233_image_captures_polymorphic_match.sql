-- 0233_image_captures_polymorphic_match.sql
-- Generalise the manual-match override from paint-only to any
-- reference table. Replaces 0232's `manual_paint_id` with a
-- polymorphic (manual_match_kind, manual_match_id) pair.
--
-- Supported kinds (validated server-side at PATCH time):
--   paint              → paints.id
--   fps_weapon         → fps_weapons.id
--   fps_armour         → fps_armour.id
--   fps_helmet         → fps_helmets.id
--   vehicle_component  → vehicle_components.id
--
-- Backfill copies any existing manual_paint_id into the new columns
-- with kind='paint'. The manual_paint_id column is kept for backwards
-- compat with route handlers that haven't migrated yet — both columns
-- get cleared together when the link is unset.

ALTER TABLE image_captures ADD COLUMN manual_match_kind TEXT;
ALTER TABLE image_captures ADD COLUMN manual_match_id INTEGER;

-- Backfill from manual_paint_id (likely 0 rows in production but
-- defensive — the column was just shipped).
UPDATE image_captures
   SET manual_match_kind = 'paint',
       manual_match_id = manual_paint_id
 WHERE manual_paint_id IS NOT NULL;

CREATE INDEX idx_image_captures_manual_match
  ON image_captures(manual_match_kind, manual_match_id);
