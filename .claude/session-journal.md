# Session Journal

## Current Focus
Crafting & Mining Planner implemented. New `/planner` route with 4-stage vertical mission pipeline. Build passes.

## What's Next
1. Deploy to staging and test planner workflow end-to-end
2. Test deep linking: `/planner?item=1&material=Lindinium`
3. Test mobile responsiveness at 375px
4. Verify KV cache: second load shows `X-Cache: HIT`
5. Consider redirecting `/crafting` and `/mining` to `/planner` after validation

## Log

### 2026-03-19 13:25 — Completed: Crafting & Mining Planner feature
- New consolidated endpoint `GET /api/gamedata/planner` with KV caching (13 parallel queries)
- `usePlanner()` hook added to useAPI.js
- 7 new files in `frontend/src/pages/CraftingPlanner/`:
  - `index.jsx` — Main page with URL state, stage visibility logic
  - `BlueprintPicker.jsx` — Stage 1: search, filter, select blueprint
  - `MaterialSlots.jsx` — Stage 2: horizontal material cards with modifier bars
  - `MiningPlan.jsx` — Stage 3: location ranking + equipment scoring
  - `QualityImpact.jsx` — Stage 4: quality distribution chart, slider, stat calculator
  - `EquipmentCard.jsx` — Equipment recommendation card with score bar
  - `plannerHelpers.js` — Pure functions: scoring, interpolation, distribution, parsing
- Route `/planner` added to App.jsx with lazy loading
- Nav item added under "Game Data" group (Crosshair icon, "Planner")
- Existing `/crafting` and `/mining` pages preserved (not redirected yet)
- Resource→element mapping built server-side with alias handling (Aluminum→Aluminium)
- Build + typecheck clean

### 2026-03-19 07:33 — Completed: Identity verification, org ops, public ops, reputation (#71, #68, #69, #70)
- Migration 0132: profile_verification_pending + verified_at/verified_handle on user_rsi_profile
- Migration 0133: 7 tables for org ops (op_types, org_ops, participants, ships, capital, earnings, payouts)
- Migration 0134: player_ratings, player_reviews, rating_audit_log, player_reputation (materialized medians)
- Backend: 3 verification endpoints in account.ts, ops.ts route file with 15+ endpoints, reputation.ts, admin audit endpoints
- Frontend: RsiProfileSection verification UI, OrgOps/ directory (list, detail, create), JoinOp page, RatingModal, ReputationBadge
- Libs: org-auth.ts (membership helper), ops-payout.ts (ratio × time proration calculator)
- Account deletion updated to cascade all new tables
- Org deletion updated to cascade all ops tables

### 2026-03-19 07:00 — Completed: All 4.7 data applied to staging
- Migrations 0129+0130 applied
- Game version `4.7.0-ptu.11450623` created (id=36)
- 306 vehicle records copied from 4.6 to version 36
- All extraction SQL applied (30+ scripts)
- Fixed: `--env=staging` syntax (not `--env staging`), factions must load before reputation, NPC loadouts split into 4 batches for D1 size limit
- Ship ports filtered from 104K→12,685 (useful types only: weapons, shields, power, etc.)
- ship_missiles skipped (missing `ammo_count` column — pre-existing schema gap)
- Loot map metadata loaded (5,446 items), locations loading (~2,521 batches, background)
- Investigated 27 new ship variants: all AI/unmanned/salvage — mission-spawned dynamically, no fixed locations

### 2026-03-18 20:45 — Completed: Mining equipment extraction
- `mining/extract_equipment.py` — new script, ingests community-validated JSON
- 19 lasers, 26 modules, 6 gadgets extracted
- SQL at `migration_mining_equipment_47ptu.sql`

### 2026-03-18 20:00 — Completed: Mining locations, quality, clustering
- **Migration 0130**: `mining_locations`, `mining_location_deposits`, `mining_clustering_presets`, `mining_clustering_params`, `mining_quality_distributions`, `mining_lasers`, `mining_modules`, `mining_gadgets`
- `mining/extract_locations.py` — new script for locations/clustering/quality from DataCore
- 49 locations (Stanton 30, Pyro 17, Nyx 2), 1,016 deposits, 28 clustering presets, 21 quality distributions
- Fixed directory traversal (files in subdirs like `system/nyx/asteroidfield/`)
- Fixed `harvestableGroups` structure (was looking for wrong key `harvestableSlotPresets`)

### 2026-03-18 19:30 — Completed: Crafting system schema + extraction
- **Migration 0129**: `crafting_resources`, `crafting_properties` (14 seeded), `crafting_blueprints`, `crafting_blueprint_slots`, `crafting_slot_modifiers`
- `crafting/extract.py` — new script parsing raw DataCore `CraftingBlueprintRecord` structure
- First attempt: 0 blueprints — raw DataCore nests under `blueprint.processSpecificData`, community JSON was pre-flattened
- Second attempt: 1,044 blueprints, 22 resources, 2,589 slots, 3,886 modifiers — matches community reference exactly
- Used uuid-based subqueries instead of `last_insert_rowid()` for reliable FK linking

### 2026-03-18 19:00 — Completed: All remaining extraction scripts run
- Mining: 46 elements, 186 compositions, 9 refining
- Reputation: 45 scopes, 371 standings, 61 faction links
- Law system: 43 infractions, 13 jurisdictions, 2 overrides
- Contracts: 84 contracts
- Shops: 87 shops, 6,317 items
- Trade commodities: 222
- Paints: 875 (needed vehicles.json from D1 — exported 303 vehicles)
- Consumables: 208
- Harvestables: 78
- Manufacturers: 141 updates

### 2026-03-18 18:30 — Completed: Vehicle components + NPC loadouts extraction
- 6 vehicle component scripts: 990 total (273 core, 196 weapons, 273 turrets, 213 misc, 26 mining, 9 salvage)
- NPC loadouts: 2,580 loadouts across 22 factions (extract.py) + 104 bundles across 9 factions (extract_bundles.py)

### 2026-03-18 18:15 — Completed: FPS gear extraction (8 scripts)
- All 8 scripts ran clean against 4.7 PTU DataCore
- fps_weapons: 353, fps_armour: 1,642, fps_attachments: 99, fps_utilities: 20, fps_helmets: 633, fps_clothing: 1,825, fps_melee: 23, fps_carryables: 1,614

### 2026-03-18 18:00 — Completed: 10 GitHub issues for 4.7 migration work (#75-#84)
- FPS gear, vehicle components, NPC loadouts, loot map, crafting system, mining, rep/law/contracts, paints/shops, StarBreaker fixes, Nyx Rockcracker

### 2026-03-18 17:45 — Completed: Localization diff
- 1,480 new strings, 98 removed, 258 modified
- Key prefixes: item (401), UI (146), crafting (144), PU missions (112), NYX/Nyx (68)

### 2026-03-18 17:30 — Completed: Loot map data integrity fix + rebuild
- **Root cause**: Windows backslash paths in uuid_index broke all cross-reference lookups
- **Fix**: Normalized `rel_path` at source (Phase 1 line 339) + `_build_path_to_uuid_index` + `_build_record_name_to_path_stem` + `table_name_to_path`
- **Impact**: Recovered 75,835 legacy item-location pairs, 6,695 corpse sources, 250 contract sources
- **Final counts**: 5,446 items, 1,245,770 container sources, 7,898 NPC, 6,317 shop, 6,695 corpse, 250 contract

### 2026-03-18 17:30 — Completed: 4.7 PTU DataCore extraction + diff analysis
- StarBreaker patched for 4.7 p4k format (extra field rewrite + ZSTD encryption auto-detect)
- extract_all.py: --source flag, PTU/EPTU/LIVE auto-detect, prefer install dir
- DataCore: 57,740 files (3.1GB), +2,358 vs live
- Diff: 2,477 added, 119 removed, 55,262 modified

### 2026-03-18 14:24 — Completed: Brain dump → 14 GitHub issues + 2 bug fixes
- 14 GitHub issues (#61–#74) from collaborator sync
- #61 fix: loot search token-based AND matching
- #62 fix: Reputation useState import

### 2026-03-17 21:50 — Completed: Org system rework implementation
- Migration 0125, RSI org scraper, verify-then-create flow, join codes, sync, deletion
