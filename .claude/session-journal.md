# Session Journal

## Current Focus
Fresh database approach for clean data reset. Plan approved, dry run first.

## What's Next
1. **IMMEDIATE: Execute fresh DB plan** (plan at `.claude/plans/modular-crunching-nygaard.md`)
   - Create sc-companion-test D1 database
   - Write export_prod.py to merge v32+v33 game data
   - Bootstrap Better Auth + apply 146 migrations
   - Load merged game data + user data
   - Verify everything
   - If clean: repeat for sc-companion-v2 (prod) and sc-companion-staging-v2
   - Cut over wrangler.toml
2. Build 4.7.0 delta extraction pipeline
3. Close GitHub issues (37 open) before Saturday March 29 launch
4. KV cache purge after data is finalized

## Log

### 2026-03-23 19:00 — Completed: 100% manufacturer coverage + extraction pipeline fixes
- **Manufacturer coverage**: 0 NULL manufacturer_id across ALL tables on both prod and staging
- **Segment scanning**: checks ALL underscore-separated segments against mfr map
- **PREFIX_TO_MANUFACTURER**: bltr→BLTR (Blue Triangle Inc.), toag→XNAA (Xi'an/Aopoa)
- **Empty Code derivation**: scitemmanufacturer.xian.json → XNAA from localization key
- **UNKN fallback**: remaining unresolvable items set to Unknown Manufacturer
- **9-agent fix batch**: paints (auto-DataCore), auec (no scdatatools), shop_locations (path fix), commodity_listings (correct data source), contracts (transient), mining (migration 0142), loot_map manufacturer backfill (+4,386 rows), CSV investigation
- **Ship ports**: 13K useful ports (filtered from 215K total), loading in background
- **Loot map rebuild**: running for both 4.6 and 4.7

### 2026-03-23 17:30 — Completed: Full data refresh with two-stage manufacturer resolution
- **lib/datacore.py**: Added `resolve_manufacturer_code()` (A=ref, B=prefix, A-real wins), `MANUFACTURER_OVERRIDES` (11 brands), `MANUFACTURER_REF_CORRECTIONS` (Fresnel→VOLT), `report_unmatched_manufacturers()`
- **19 extraction scripts**: All now use `resolve_manufacturer_code()` + call `report_unmatched_manufacturers()` at end
- **3 scripts fixed**: contracts, auec_prices, acquisition_types — missing `sys.path.insert`
- **Extractions run**: 47 SQL files for 4.6.0-live + 47 for 4.7.0-ptu
- **Applied to production** (sc-companion): all phases, 0 failures on core data
- **Applied to staging** (sc-companion-staging): 4.6 + 4.7 data, crafting 1,044 blueprints loaded
- **Manufacturer coverage**: fps_weapons 99.4%, fps_armour 97.6%, helmets 94.3%, vehicle_components 91.7%, clothing 99.3%
- **Fresnel LMG**: confirmed VOLT on production (was the original bug that started the manufacturer overhaul)
- Committed to scbridge/tools/scripts repo

### 2026-03-20 18:20 — Completed: Wails desktop app with React+Tailwind UI
- **Restructured** sc-companion from CLI to Wails v2 desktop app
- **Go side:** `main.go` (Wails entry, frameless dark window 1280x800), `app.go` (App struct with 7 bound methods: GetStatus, GetConfig, SetDebugMode, GetRecentEvents, GetEventCounts, GetTotalEvents)
- **Frontend:** React + Vite + Tailwind 4, matching scbridge.app crafting page aesthetic
  - `TitleBar.jsx` — custom frameless titlebar with SC Bridge logo SVG, window controls
  - `Dashboard.jsx` — hero with SVG logo, stat cards with HUD corners, data source status
  - `StatusBar.jsx` — bottom bar with proxy/tailer status, player info, location
  - `EventFeed.jsx` — live event stream (debug mode only), filter, auto-scroll, source/type coloring
  - `Settings.jsx` — read-only config display
- **Design tokens:** sc-darker, sc-dark, sc-panel, sc-border, sc-accent (cyan), sc-accent2, Electrolize/Inter/JetBrains Mono fonts
- **Dev fallback:** frontend shows placeholder when not running in Wails (`wails dev`)
- **All builds pass:** Go build, frontend build, 14 grpcproxy tests pass
- CLI version preserved at `cmd/companion/main.go`

### 2026-03-20 18:05 — Completed: Proto extraction from StarCitizen.exe
- Ran StarBreaker `proto-set-extract` on PTU 4.7 executable
- **730KB** FileDescriptorSet (`sc.pb`) with **549 gRPC methods** across 36 services
- Also extracted 389 .proto files to `protos/` for reference
- Key services: ledger (aUEC), reputation, blueprint_library, friends, presence, entitygraph, chat, notifications, stats
- Tests updated for real schema (GetFundsResponse has `repeated Ledger ledgers`, not `amount`)
- All 14 tests pass against real descriptors

### 2026-03-20 17:55 — Completed: gRPC interceptor implementation
- **Architecture:** HTTP CONNECT proxy on localhost:8443 → TLS MITM with per-host leaf certs → gRPC UnknownServiceHandler → RawCodec bidirectional forwarding → async protobuf decode → event bus
- **New files (8):** `descriptors/embed.go`, `registry.go`, `certgen.go`, `filter.go`, `decoder.go`, `handler.go`, `proxy.go` (rewrite), `Makefile`
- **Modified (2):** `config.go` (ProxyEnabled, ProxyPort, DataDir), `main.go` (--proxy-port, --no-proxy flags, proxy startup)
- **Tests (4 files, 14 tests):** registry (method lookup, invalid data), certgen (CA gen/reload, leaf chain verification), filter (block/redact), decoder (GetFunds decode, blocked service, unknown method, event type formatting)
- **All tests pass**, build clean, vet clean
- **Dependencies added:** google.golang.org/grpc v1.79.3, google.golang.org/protobuf v1.36.11
- **Placeholder sc.pb** with fake LedgerService — real descriptor needs proto extraction from StarCitizen.exe
- **Design decisions:** Per-connection gRPC server (not shared) for clean target host passing; singleConnListener pattern; async decode goroutines; backend conn cache in sync.Map
- **UI direction confirmed:** Wails for native GUI, crafting page design language, SC Bridge logo for systray + UI

### 2026-03-20 11:30 — Completed: Loot map data quality overhaul
- **Root cause:** `build_loot_map.py` dropped items without explicit loot sources (shop/container/NPC/contract). In-game kiosk shops sell by type, not UUID — 4,619 purchasable items were invisible.
- **Fix 1 — `build_loot_map.py`:** Added Phase 6d — scans uuid_index for all purchasable items (SCItemPurchasableParams flag set during Phase 1 scan), adds missing ones with `shop: "purchasable"`. Filtered to PURCHASABLE_TYPES set (excludes Paints, Vehicles, Cargo).
- **Fix 2 — `load_to_d1.py`:** Corrected `WeaponGun` → `vehicle_components` (was wrongly mapped to `fps_weapons`). Added 15 new type mappings (WeaponDefensive, TractorBeam, SalvageHead, etc.).
- **Fix 3 — manufacturer_name:** vehicle_components for `4.6.0-live.11377160` had all NULL manufacturer_id. Back-filled from `4.6.0-live.11319298` version. Updated 969 loot_map rows with manufacturer names.
- **Results:** 5,218 → 6,615 items. WeaponGun: 69 → 179. All screenshot weapons verified (Lightstrike III, Reign-3, Singe, Sledge III).
- **Both envs:** Production + staging at 6,615 loot_map rows, 1,092,839 location rows.
- **Staging cleanup:** Deleted stale 4.7 PTU data (1.25M locations + 5,446 loot_map rows) — DB was at max size.
- Files changed: `tools/scripts/loot_map/build_loot_map.py`, `tools/scripts/loot_map/load_to_d1.py`


### 2026-03-20 08:55 — Completed: Crafting Materials tab — mining location + quality data
- Backend: Added resource location query to crafting endpoint in `gamedata.ts` — joins deposits→compositions→locations with quality distributions
- Element→resource mapping: strips `_ore`/`_raw` suffix, capitalizes, handles aluminium→aluminum spelling
- Quality distribution matching: extracts rock tier from class_name, matches to system-specific distribution (Default vs Pyro)
- Frontend: `SlotCard.jsx` — collapsible "Where to find" per material with location table + quality band probabilities
- `craftingUtils.js` — Added normalCDF (erf approximation), qualityBandProbabilities, 49-entry LOCATION_NAMES map, ROCK_TIER_INFO
- `BlueprintDetail.jsx` — passes `data.resource_locations` to SlotCard
- Response adds `resource_locations` map: resource_name → [{location, system, type, rock_tier, element_pct, quality}]
- Build + typecheck clean

### 2026-03-19 19:54 — Completed: Crafting system visual overhaul
- Deleted `Crafting.jsx` monolith, replaced with `Crafting/` directory (8 files)
- `index.jsx` — Hero with HUD corners, animated stats row, pill-chip filters, responsive 4→1 col card grid with stagger animations
- `BlueprintDetail.jsx` — Detail page with craft time ring, tabbed Materials/Quality Sim
- `BlueprintCard.jsx` — Glassmorphic cards with type badges, hover glow, resource color dots
- `FilterBar.jsx` — Search + type/subtype pills + resource chips with deterministic HSL colors
- `StatsRow.jsx` — 4 animated stat cards with count-up numbers
- `SlotCard.jsx` — Material slots with colored resource chips + modifier bars
- `QualitySim.jsx` — Per-slot quality sliders (0-1000) with gradient tracks, real-time stat diff
- `craftingUtils.js` — Shared helpers (formatTime, resourceColor hash, interpolateModifier)
- Added `/crafting/:id` route in App.jsx, `stagger-fade-up` + `glow-pulse` in tailwind config
- No backend changes — uses existing `/api/gamedata/crafting` endpoint
- Build passes clean



### 2026-03-19 18:55 — Completed: RSI Profile Verification Flow Restructure
- Created `src/lib/rsi-sync.ts` — extracted sync helper from account.ts (zero behavior change)
- Updated `POST /api/import/hangar-sync` — extension sync now auto-verifies user_rsi_profile
- Updated `POST /api/account/rsi-verify/generate` — removed sync prerequisite, updated instructions URL
- Updated `POST /api/account/rsi-verify/check` — strict bio div parsing + auto-sync after verify
- Consolidated `GET /api/account/rsi-profile` — returns profile + extensionProfile + verification
- Removed `GET /api/account/rsi-verify/status` (now part of consolidated endpoint)
- Rewrote `RsiProfileSection.jsx` — 4 UI states: verified, pending, unverified+data, no-data
- No-data state shows two cards: "Via Extension" / "Verify Manually"
- Build + typecheck pass clean

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
