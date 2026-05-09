-- 0229_backfill_pledge_kind_other.sql
-- Final pass on the kind backfill: anything still NULL after 0227 +
-- 0228 was conceptually outside the canonical taxonomy (digital
-- downloads, CCU upgrade tokens, ship name reservations, schematics,
-- legacy alpha entitlements, "Sneak-Peek", etc.). Rather than leave
-- them NULL — which makes them invisible to filter chips — bucket
-- them as "Other" so the Hangar UI's coverage stays at 100%.
--
-- Mirrors src/lib/pledgeKind.ts: any title that doesn't match a
-- canonical rule now returns "Other". Rows with no title at all
-- stay NULL on purpose (those are data-quality issues we want to
-- keep visible).

UPDATE user_pledge_items
   SET kind = 'Other'
 WHERE kind IS NULL
   AND title IS NOT NULL
   AND title != '';
