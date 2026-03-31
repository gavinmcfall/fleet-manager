# Session Journal

## Current Focus
Shipped: privacy/stealth mode, font preference, and sidebar collapsed state now synced to DB via user_settings. Fixed race condition (prefs === null guard) that caused Edge/Firefox to miss the initial sync.

## What's Next
1. Resolve vehicle_ports gap (-54% vs prod) — agent investigating
2. Resolve npc_loadout_items gap (-37% vs prod) — agent investigating
3. Resolve shops gap (-21% vs prod) — agent investigating
4. Load final pipeline output to test DB
5. Schema.sql completion and review
6. Seed.sql extraction from prod DB
7. Phase E: API sync engine
8. Phase F: Frontend/backend migration (remove game_version_id)

## Log

### 2026-04-01 10:05 — Completed: UI prefs synced to DB
- Privacy mode, stealth %, font preference, sidebar collapsed now stored in user_settings
- Zod schema extended with privacyMode, stealthPercent, sidebarCollapsed
- All 3 hooks (usePrivacyMode, useFontPreference, App.jsx sidebar) follow API-wins pattern with localStorage as fast cache
- Fixed race condition: prefs === null guard prevents hasSynced firing before first API response arrives (Edge/Firefox fresh-session bug)
- 9 new backend tests, 250 total passing

### 2026-04-01 07:30 — Completed: v2 pipeline final verification run
- Full pipeline run: 50 tables, 682,522 rows in 28 minutes (4.7.0-live)
- Graph: 83,692 nodes, 97,858 edges from 6 handlers
- Key wins vs prod (4.7.0-live only): loot_map +260%, missions +188%, contracts +550%, vehicle_components +64%, star_map +114%, weapon_racks +443%
- 15 entirely new tables not in prod (world_placements, shop_item_links, mining detail, etc.)
- 3 areas where v2 behind: vehicle_ports (4,960 vs 10,757), npc_loadout_items (11,184 vs 17,803), shops (69 vs 87)
- Investigation agents deployed for all 3 gaps
- Production baseline captured per-version (4.6.0 and 4.7.0 separated)

### 2026-03-31 09:30 — Started: v2 extraction pipeline build
- Mallachi approved design doc at 09:07 via Discord
- Moved 59 v1 extraction script directories to extraction_pipeline_v1/
- Created v2 pipeline: scan/indexer.py, enrich/resolver.py + extractors.py, emit/sql_writer.py
- 4-stage architecture: SCAN -> GRAPH -> ENRICH -> EMIT
- 11 category-aware stat extractors (medgun, multitool, binoculars, armour, helmet, etc.)
- First smoke test: scan found 57,833 entities, 146,632 UUIDs, 0 errors
- Fixed: tags as strings vs dicts, records cached in memory to avoid NFS re-reads
- Schema.sql design agent running in background
- Design doc: tools/docs/design/v2-extraction-pipeline.md

### 2026-03-30 14:00 — Decision: v2 pipeline architecture approved
- User corrected course: don't modify v1 scripts, build brand new v2
- Fresh database approach: schema.sql, no migrations, user data migrated
- 3-tier data: p4k extraction, API sync engine (RSI/UEX/Cornerstone/SC-Companion), seed data
- Column-level extraction_audit in separate D1 database
- Multi-source price resolution: most recent observation wins
- SC-Companion crowdsourced data as highest-confidence price source
- Mallachi co-reviewing all major decisions going forward

### 2026-03-30 10:00 — Completed: Full gap analysis across all item categories
- 0/9 extractors use tags (all need loot_rarity, can_loot, inventory_volume)
- FPS weapons store wrong stats for tools (medguns, multitools, binoculars)
- Armour environmental stats completely missing (EVA, temperature, radiation, storage)
- Helmets missing flashlight, visor, FOV, temperature, radiation
- Ship component heat model + reliability never extracted
- Confirmed dead ends: hacking chips server-side, no portable EMP, flash/smoke null params

### 2026-03-29 12:00 — Completed: Shop location investigation
- Exhaustively searched p4k data for additional shop inventory sources
- Found shopkiosk, shopdisplays, prefabs, globalshopparams -- none contain inventory mappings
- Display racks define SIZE constraints, not item assignments
- ShopInventories JSON files ARE the single source of truth
- Attrition-4 genuinely only listed at HD Showcase Lorville in p4k data (both 4.6 and 4.7)
- Conclusion: remaining shop coverage gaps are CIG runtime population, not extractable from static files

### 2026-03-29 11:30 — Completed: Loot dedup + junk filtering
- Found 296 duplicate name+category groups (667 extra rows) in loot_map
- Root cause: CIG has turret variants + event colour swaps with same localized name but different UUIDs
- Fixed in build_loot_map.py phase8: merges items with same (name, type), keeps UUID with most locations
- Also filters PLACEHOLDER, ???, Wreckage junk entries
- Committed to tools repo (9cbaaee), all 193 tests pass

### 2026-03-29 11:00 — Completed: Manufacturer resolution Phase 2
- Re-extracted 4.6.0 FPS tables (9 scripts) with manufacturer resolution
- Re-extracted 4.6.0 manufacturers, consumables, props
- Fixed vehicles regex (worktree agent) -- 0% to 100% manufacturer coverage
- Applied cross-version manufacturer UPDATEs to loot_map on staging
- Applied srvl->Doomsday prefix mapping (+82 items)
- Final staging results: loot 77%->8% NULL, ships 32%->2% NULL
- Applied all fixes to production: loot 77%->6% NULL, ships 32%->2% NULL
- Committed vehicle fix + loot quality improvements to tools repo (94a4c27)

### 2026-03-29 10:46 — Started: Data quality fix team (16-agent plan)
- Phase 1: 4 investigation agents (manufacturer, rarity, shops, minor gaps)
- Key findings that changed the plan:
  - Shop locations: NOT a bug -- pipeline correct, game data genuinely sparse
  - FPS rarity: NOT 79% missing -- loot_map already 94-100% for FPS (gap is ship_components at 3%)
  - Manufacturer NULL: IS the big problem -- 4.6.0 extracted before manufacturer resolution existed
  - NPC loadouts: visible_item_count=0 for all v2 loadouts
- Phase 2: Fixed extraction scripts, re-extracted 4.6.0 data, applied to both environments
