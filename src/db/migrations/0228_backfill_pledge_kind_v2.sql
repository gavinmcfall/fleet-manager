-- 0228_backfill_pledge_kind_v2.sql
-- Second pass at the user_pledge_items.kind backfill. After 0227's
-- conservative ruleset, ~1,848 rows still had NULL kind on staging
-- (16% gap → 11% gap). Analysis surfaced four big buckets we can
-- now classify with high precision: armour pieces in triplet sets
-- (Strata/Chiron/Wrecker Payback Arms/Core/Legs), suits + clothing
-- (Hat/Jumpsuit/Jacket/etc.), explicit weapons (Rifle/SMG/Repeater),
-- decorative items (Poster/Model/Coin/Skull/Storage Chest), and
-- paint variants (* Paint).
--
-- Mirrors src/lib/pledgeKind.ts v2 ruleset. Rule order matters —
-- decorative SKUs ("Helmet Statue") run before armour rules so they
-- don't get mis-classified as FPS Equipment.

-- ── Hangar decoration (run first) ─────────────────────────────────
UPDATE user_pledge_items
   SET kind = 'Hangar decoration'
 WHERE kind IS NULL
   AND (
        LOWER(title) LIKE '% poster%' OR LOWER(title) LIKE 'poster %' OR LOWER(title) = 'poster'
     OR LOWER(title) LIKE '%wallpaper%'
     OR LOWER(title) LIKE '% display' OR LOWER(title) LIKE '% display %'
     OR LOWER(title) LIKE '% artifact%'
     OR LOWER(title) LIKE '%fishtank%'
     OR LOWER(title) LIKE '% prop' OR LOWER(title) LIKE '% prop %'
     OR LOWER(title) LIKE '% model' OR LOWER(title) LIKE '% model %'
     OR LOWER(title) LIKE '% coin' OR LOWER(title) LIKE '% coin %'
     OR LOWER(title) LIKE '% skull%'
     OR LOWER(title) LIKE '%sq. %'
     OR LOWER(title) LIKE '%squadron badge%'
     OR LOWER(title) LIKE '%storage chest%'
     OR LOWER(title) LIKE '%themed %bed%'
     OR LOWER(title) LIKE '%themed %chair%'
     OR LOWER(title) LIKE '%cargo chair%'
     OR LOWER(title) LIKE '%fish school%'
     OR LOWER(title) LIKE '%space plant%'
     OR LOWER(title) LIKE 'takuetsu %'
     OR LOWER(title) LIKE 'h-deco%'
   );

-- ── Skin (paint variants) ────────────────────────────────────────
UPDATE user_pledge_items
   SET kind = 'Skin'
 WHERE kind IS NULL
   AND (
        LOWER(title) LIKE '% paint'
     OR LOWER(title) LIKE '% paint %'
   );

-- ── FPS Equipment — armour pieces + suits + clothing + weapons ───
-- Combined into a single UPDATE to keep the migration short. Matches
-- everything our existing FPS Equipment kind currently covers plus
-- the new triplet/clothing/weapon patterns.
UPDATE user_pledge_items
   SET kind = 'FPS Equipment'
 WHERE kind IS NULL
   AND (
        -- armour explicit
        LOWER(title) LIKE '%armor arms%' OR LOWER(title) LIKE '%armor core%' OR LOWER(title) LIKE '%armor legs%'
     OR LOWER(title) LIKE '%armour arms%' OR LOWER(title) LIKE '%armour core%' OR LOWER(title) LIKE '%armour legs%'
     OR LOWER(title) LIKE '%arm armor%' OR LOWER(title) LIKE '%leg armor%'
     OR LOWER(title) LIKE '%combat armor%' OR LOWER(title) LIKE '%combat armour%'
     OR LOWER(title) LIKE '%tactical armor%' OR LOWER(title) LIKE '%tactical armour%'
        -- triplet pattern (X Arms/Core/Legs <variant>) — case-sensitive
        -- matches Title Case so "firearms" doesn't trigger.
     OR title LIKE '% Arms' OR title LIKE '% Arms %' OR title LIKE '% Arms (%'
     OR title LIKE '% Legs' OR title LIKE '% Legs %' OR title LIKE '% Legs (%'
     OR title LIKE '% Core' OR title LIKE '% Core %' OR title LIKE '% Core (%'
        -- suits
     OR LOWER(title) LIKE '%jumpsuit%'
     OR LOWER(title) LIKE '% suit' OR LOWER(title) LIKE '% suit %'
     OR LOWER(title) LIKE '%flight suit%' OR LOWER(title) LIKE '%flightsuit%'
     OR LOWER(title) LIKE '%hazard suit%'
        -- clothing
     OR LOWER(title) LIKE '% hat' OR LOWER(title) LIKE '% hat %'
     OR LOWER(title) LIKE '%top hat%' OR LOWER(title) LIKE '%monocle%'
     OR LOWER(title) LIKE '%t-shirt%' OR LOWER(title) LIKE '% tee'
     OR LOWER(title) LIKE '% shirt' OR LOWER(title) LIKE '% shirt %'
     OR LOWER(title) LIKE '% pants%'
     OR LOWER(title) LIKE '% jacket%'
     OR LOWER(title) LIKE '% gloves%'
     OR LOWER(title) LIKE '% coat' OR LOWER(title) LIKE '% coat %'
     OR LOWER(title) LIKE '% hood' OR LOWER(title) LIKE '% hood %'
     OR LOWER(title) LIKE '% mask' OR LOWER(title) LIKE '% mask %'
     OR LOWER(title) LIKE '% vest%'
     OR LOWER(title) LIKE '% sweater%'
     OR LOWER(title) LIKE '% hoodie%'
     OR LOWER(title) LIKE '%outfit%'
     OR LOWER(title) LIKE '%mobiglas%'
     OR LOWER(title) LIKE '%head gear%'
        -- weapons + attachments
     OR LOWER(title) LIKE '% rifle' OR LOWER(title) LIKE '% rifle %'
     OR LOWER(title) LIKE '% smg' OR LOWER(title) LIKE '% smg %'
     OR LOWER(title) LIKE '% pistol%'
     OR LOWER(title) LIKE '% repeater%'
     OR LOWER(title) LIKE '% shotgun%'
     OR LOWER(title) LIKE '% sniper%'
     OR LOWER(title) LIKE '% carbine%'
     OR LOWER(title) LIKE '% launcher%'
     OR LOWER(title) LIKE '% gatling%'
     OR LOWER(title) LIKE '%cannon'
     OR LOWER(title) LIKE '% weapon' OR LOWER(title) LIKE '% weapon %'
     OR LOWER(title) LIKE '%attachment%'
   );
