# Session Journal

## Current Focus
Pipeline running with all accumulated fixes. After pipeline completes, load to staging and verify.

### 2026-04-07 07:30 — Completed: Paint default detection + auto-inheritance
- **Root cause:** 58 paints with `@LOC_PLACEHOLDER` names filtered by resolver placeholder check
- **resolver.py:** Exempt paints from placeholder filter, humanize names from filename
- **paint_vehicles.py:** `is_default_for_vehicle` flag from vehicle SubGeometry[0].Tags → paint @Tag matching
  - Vehicle tags always start with `Paint_`, paint @Tags sometimes omit it — try both forms
  - 280/286 vehicles matched to their default paint (6 unmatched = unreleased ships)
  - Carrack base → paint_carrack_expedition, Carrack Expedition → paint_carrack_default (verified)
- **Migration 0181:** `is_default_for_vehicle INTEGER DEFAULT 0` on paint_vehicles
- **fleet-import.ts:** After fleet swap, INSERT OR IGNORE default paints for all owned vehicles
- All 239 backend tests pass, typecheck clean (pre-existing characters.ts errors only)

### 2026-04-07 09:45 — Completed: Weapon rack variant support (#22)
- **Root cause 1:** `_is_non_vehicle_rack` skipped all digit-prefixed racks (e.g. `Weapon_Rack_2_Slots_RSI_Polaris_DisplayCase`) — too aggressive
- **Fix:** Check if remainder after digit+slot prefix contains a manufacturer code; also strip prefix in `_extract_vehicle_name`
- **Recovered:** Polaris (2 racks), Idris (1), Aurora (1) — 4 racks across 3 vehicles
- **Root cause 2:** Racks linked to ONE vehicle only — variants (PYAM Exec, BIS, etc.) got nothing
- **Fix:** Migration 0182 changes UNIQUE from `(uuid, game_version_id)` to `(uuid, vehicle_id, game_version_id)` for both weapon racks AND suit lockers. load_staging.py duplicates rack/locker rows to all `class_name || '_%'` variants.
- **Not regressions:** 100i and Corsair PYAM Exec have no rack files in 4.7 p4k — PROD data was from older version
- **STG already ahead:** 63 vehicles with racks vs PROD's 23

### 2026-04-07 ~14:00 — Completed: Shop/terminal/inventory redesign spec
- Brainstormed with superpowers:brainstorming skill
- Approved Approach B: three-layer model (shops -> terminals -> terminal_inventory + price_observations)
- ShopNode UUID from MarkDistributions is canonical shop identity
- `shop_name_key` on terminals for companion log ingestion (stable text, indexed)
- UEX sync via scheduled cron + user-triggered "Check for Latest" button
- Tiered retention: all for 7d, hourly for 30d, daily for 90d, then prune
- `unlinked_sources` table catches unknown shops from any provider
- Spec committed to tools/docs/design/shop-terminal-inventory-redesign.md
- D3 (weapon racks) CLOSED -- not a regression, STG is 3x ahead of PROD

### 2026-04-07 ~14:30 — Started: Pipeline run with accumulated fixes
- Paint: resolver placeholder exemption + humanized names + is_default_for_vehicle
- Weapon racks: digit-prefix fix + variant duplication
- Armour: em/ir_emission, weight class, durability from extractors.py (previous session)
- Shop inventory: zero-price filter removed (previous session)

### 2026-04-06 19:55 — Completed: 12 fixes verified on staging
- A1: Dimensions FIXED — Carrack L=126,B=74,H=30 (was L=30,H=74). Sorted approach, not fixed axis.
- A2: manufacturer_name FIXED — 95% on shared items (5,771/6,062 vs PROD 93%). 53% overall is because STG has 6K+ extra items (templates, carryables) without manufacturers. Only 78 regressions (Doomsday armour/helmet).
- A3: sub_type FIXED — 99.9% on shared items (6,055/6,062). Card display uses comp_sub_type from stat table JOINs.
- A4: Mining names FIXED — "Agricium Ore" not "agricium_ore"
- A6: Magazine FIXED — "A03 Sniper Rifle Magazine (15 cap)" not "gmni_sniper_ballistic_01_mag". magazine_size=15.
- A7: Law FIXED — 24 triggers_json, 43 hide_crime_journal booleans
- A8: Locker count FIXED — all 12 lockers show count=1 (was 8)
- C1: Loot sets FIXED — 1,089 sets (was 0, PROD has 1,062)
- B3/B4: Mission givers FIXED — 18 bios, 3 portraits (was 0/0)
- E7: Debug names FIXED — 0 remaining (was 694)
- E1: FALSE POSITIVE — careers/roles count was double-counted across game versions
- B2: FALSE POSITIVE — concept ship backfill already includes size/manufacturer
- Bug found: loot.py Step 8 output dict didn't carry manufacturer_name/sub_type through. Fixed, re-ran pipeline.

**Completed (12/24 + false positives found):**
- A1: Ship dimensions — sorted approach (longest=length). CIG axis varies per ship.
- A2: manufacturer_name on loot_map — resolve_manufacturer_code via AttachDef + mfr_map
- A3: sub_type on loot_map — AttachDef.SubType extraction
- A4: Mining elements — humanized filename (Agricium Ore)
- A6: Magazine display_name — SCItemPurchasableParams.displayName via localization + magazine_capacity
- A7: Law triggers_json + booleans — 3 boolean fields + triggers array
- A8: Suit locker_count — 1 per entity not 8 per port
- C1: Loot sets lm.type→lm.category filter (2 locations)
- E7: Debug name filters in datacore.py
- B3/B4: Mission giver biography + portrait backfill from NERDZ
- Pipeline.py: pass mfr_map + loc to extractors

### 2026-04-06 22:15 — Session pause: 18/24 regressions fixed
**Fixes completed this session:**
- A1: Ship dimensions (sorted, not fixed axis)
- A2: manufacturer_name on loot_map (96% shared, 0 regressions + Doomsday fixup)
- A3: sub_type on loot_map (99.9% shared)
- A4: Mining element names (humanized)
- A6: Magazine display_name + capacity
- A7: Law triggers_json + booleans
- A8: Suit locker_count (1 per entity)
- C1: Loot sets filter (lm.type→lm.category)
- E7: Debug name filters
- B3/B4: Mission giver bios + portraits (NERDZ backfill)
- #5: NPC locations in POI (class_name→loot_map UUID resolution, 26K entries)
- #9: Contract templates resolved ({Variable} format), requirements_json (1,993), reward_text (84)
- #12: has_contracts flag (97 items via contract item_rewards_json)
- #15: Mission reward_amount NULLIF fix (1,858 missions)
- #16: All 6 NPC factions recovered (30/30) — _detect_faction fix + pattern matching + Marketing manual insert
- #19: FPS Gear Container/Sustenance (NERDZ backfill — STOPGAP, needs pipeline fix, see memory)

**Pipeline changes made (in tools repo, not committed):**
- enrich/vehicles.py: dimension sorting
- enrich/loot.py: manufacturer_name + sub_type extraction + output
- enrich/vehicle_storage.py: locker_count=1
- enrich/reference_data.py: mining element names, law triggers/booleans
- enrich/ammo_types.py: display_name + magazine_capacity
- enrich/npc_bundles.py: _detect_faction directory path fix
- enrich/contract_generators.py: (unchanged but load_staging generates contracts differently)
- lib/datacore.py: debug name filters
- pipeline.py: mfr_map + loc passthrough, NPC class_name→UUID resolution, _class_to_loot_uuid lookup

**Load script changes (load_staging.py):**
- Contract template resolution (_resolve_template two-hop)
- Contract requirements_json (min_standing + rep_rewards)
- Contract reward_text backfill from NERDZ
- Contract item rewards → loot_item_locations (has_contracts)
- Ruto pu_mission contracts backfill
- Doomsday manufacturer fixup
- Frontier Fighters faction insert
- fps_carryables backfill from NERDZ (STOPGAP)
- Mission giver biography/portrait backfill
- Suit locker specific mappings (Apollo, Zeus, Constellation)
- NPC faction patterns (Criminal Gang, ASD, CFP, Contested Zones, Frontier Fighters)

**Query changes (queries.ts + gamedata.ts):**
- LOOT_EXCLUSION_FILTER: lm.type→lm.category
- getLootSets + getLootSetBySlug: same filter fix
- Mission reward: NULLIF(m.reward_amount, 0) for COALESCE

**Outstanding (for morning):**
- #20: 69 shops with 0 inventory (pipeline SOLD_AT edge coverage)
- #21: Trade commodities lost listings (related to #20)
- #23: 38 container locations missing from POI
- #24: em/ir_emission on armour detail (unverified)
- #25: 221 items Common→N/A rarity (unverified)
- D1: 847 paints missing (investigation)
- D2: 79 loot items missing (investigation)
- D3: 10 weapon racks per-ship (investigation)
- **PIPELINE FIX NEEDED**: carryable extraction without AttachDef (see memory: project_carryable_extraction_gap.md)

**FALSE POSITIVES found during double-checking:**
- E1 (careers/roles): PROD had 10 careers × 2 game versions = 20 rows. STG has 11 unique. NOT missing.
- B2 (concept ships): safe_cols already includes size, manufacturer_id. Backfill working correctly.

**Pipeline running on Windows** (b208hel69) — in Stage 2 graph

**Remaining real issues:**
- A5: NPC factions — needs pipeline logging to find skipped bundles
- B1: Contract reward_text — need to check data source
- B5: has_contracts flag — NPC loot_item_locations empty (item_uuid mismatch)
- B6: em/ir_emission — need to verify in DB after pipeline
- C2: NPC locations in POI — same root cause as B5 (item_uuid mismatch)
- E2: FPS Gear Container gap — 861 items genuinely missing, not just reclassified
- E3/E4: Shop inventory gaps — pipeline SOLD_AT edge coverage limitation
- E5: 38 container locations missing — loot table → container mapping gap
- E6: 221 items Common→N/A — need to check if they're in loot tables
- D1-D3: Investigations pending

## Log

### 2026-04-06 18:10 — Completed: Full API + Visual Audit — all fixable issues resolved
- POI page: FIXED — LOOT_EXCLUSION_FILTER changed from lm.type to lm.category (90 containers, 132 shops now showing)
- Production status: FIXED — 269/316 vehicles now have status (251 flight ready, 18 in concept) via NERDZ backfill
- Suit lockers: FIXED — 10/12 linked (3 specific mappings: Apollo, Zeus, Constellation). 2 shared AEGS lockers remain unlinked.
- KV cache: Root cause of stale responses. Must purge specific keys after deploys, not just bulk purge.
- Deploy gotcha: `npm run build` required before `wrangler deploy --env staging` — .wrangler/deploy/config.json points to dist/sc_bridge/wrangler.json
- Remaining: shop inventory data completeness (extraction gap), paint/ship images (NERDZ migration), mission templates (~mission() syntax)

### 2026-04-06 17:25 — Completed: Pipeline + load + deploy to staging
- Pipeline ran on Windows (15 min vs 90+ on WSL2) — PYTHONUTF8=1 for encoding
- Weapon racks: 85 racks, 85/85 with total_ports>0 and vehicle linked
- Suit lockers: 12 lockers, 7/12 with vehicle linked (5 have generic entity names)
- Shops: 169 total, 0 unresolved loot locations (was 8,218/34,862 = 24%)
- NPC loadout items: 19,924 items, 100% resolved_name (humanized), loot_item_id=0 (UUID mismatch — different ID spaces)
- FK fixups: PRAGMA foreign_keys=OFF needed for component cascade delete, manufacturer column name fix (manufacturer_name not manufacturer)
- Output dir: /home/gavin/scbridge/tools/scripts/output/ (not extraction_pipeline_v2/output/)

### 2026-04-06 16:15 — Plan: Fix ALL data gaps at once
- Deep investigation: 5 false positives (mining stats, trade base_price, mission templates), 3 new fixes needed, 3 already coded, 1 deferred (salvageable components)
- Fix 1: Weapon racks — aggregated 511 per-port rows → ~89 per-rack rows with total_ports/rifle_ports/pistol_ports
- Fix 2: Suit lockers — aggregated 68 per-port rows → ~12 per-locker rows with locker_count + vehicle_id FK fixup
- Fix 3: NPC loadout items — resolved_name + loot_item_id denormalization via post-load UPDATE
- Pipeline run started, then wipe DB + load + deploy + full audit

### 2026-04-06 13:45 — Completed: 100% equipped component typing + weapon rack cleanup
- Equipped components: 3,477/3,477 typed (100%) across all ships
- Weapon racks: 89/89 ship-specific racks linked (100%), 6 generic templates filtered
- Cleanup removed ~1,800 junk entities from vehicle_components

### 2026-04-06 12:25 — Completed: Full API audit → 19 PASS, 2 PARTIAL, 0 FAIL
- Fixed: contracts 500, NPC HAVING clause, missions COALESCE, shop slugs
- All previously broken endpoints now working

### 2026-04-06 10:30 — Completed: Close final data gaps
- Paint images: 0 → 837, Speed: 148 → 235, NPC factions: 10 → 25, Cargo: 60 → 166
