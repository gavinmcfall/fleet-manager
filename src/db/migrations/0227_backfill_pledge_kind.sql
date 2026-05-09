-- 0227_backfill_pledge_kind.sql
-- Backfill user_pledge_items.kind for the ~16% of rows where RSI's
-- hangar markup didn't supply a `.kind` element on the scrape (newer
-- armour sets, festival cosmetics, hangar SKUs, etc.).
--
-- Mirrors the precision-over-recall ruleset in src/lib/pledgeKind.ts.
-- Only rows whose title contains an unambiguous token get a label —
-- everything else stays NULL on purpose.
--
-- Hangar decoration: VFG/Self-Land/Aeroview Hangar, Plushie, Statue,
-- Trophy, Centerpiece. Run BEFORE the FPS Equipment update so a
-- "Helmet Statue" SKU lands as decoration, not armour.
UPDATE user_pledge_items
   SET kind = 'Hangar decoration'
 WHERE kind IS NULL
   AND (
        LOWER(title) LIKE '% hangar%'
     OR LOWER(title) LIKE 'hangar %'
     OR LOWER(title) = 'hangar'
     OR LOWER(title) LIKE '%plushie%'
     OR LOWER(title) LIKE '%statue%'
     OR LOWER(title) LIKE '%trophy%'
     OR LOWER(title) LIKE '%centerpiece%'
   );

-- FPS Equipment: Helmet, Backpack, Undersuit, Boots, "Armor/Armour Set",
-- and the Monde-style "Keystone" suffix that flags newer armour sets.
UPDATE user_pledge_items
   SET kind = 'FPS Equipment'
 WHERE kind IS NULL
   AND (
        LOWER(title) LIKE '% helmet%'
     OR LOWER(title) LIKE 'helmet %'
     OR LOWER(title) = 'helmet'
     OR LOWER(title) LIKE '%backpack%'
     OR LOWER(title) LIKE '%undersuit%'
     OR LOWER(title) LIKE '% boots%'
     OR LOWER(title) LIKE 'boots %'
     OR LOWER(title) = 'boots'
     OR LOWER(title) LIKE '%armor set%'
     OR LOWER(title) LIKE '%armour set%'
     OR LOWER(title) LIKE '% keystone%'
     OR LOWER(title) LIKE 'keystone %'
     OR LOWER(title) = 'keystone'
   );
