# Session Journal

## Current Focus
Data quality fixes applied to staging + production. Shop location investigation concluded — p4k data is the hard limit.

## What's Next
1. Rebuild loot_map.json with dedup fix and reload to both environments
2. Apply remaining prefix→manufacturer mappings to production (srvl→Doomsday done, others pending)
3. Consider fresh-DB-per-release architecture for next patch

## Log

### 2026-03-29 12:00 — Completed: Shop location investigation
- Exhaustively searched p4k data for additional shop inventory sources
- Found shopkiosk, shopdisplays, prefabs, globalshopparams — none contain inventory mappings
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
- Fixed vehicles regex (worktree agent) — 0% → 100% manufacturer coverage
- Applied cross-version manufacturer UPDATEs to loot_map on staging
- Applied srvl→Doomsday prefix mapping (+82 items)
- Final staging results: loot 77%→8% NULL, ships 32%→2% NULL
- Applied all fixes to production: loot 77%→6% NULL, ships 32%→2% NULL
- Committed vehicle fix + loot quality improvements to tools repo (94a4c27)

### 2026-03-29 10:46 — Started: Data quality fix team (16-agent plan)
- Phase 1: 4 investigation agents (manufacturer, rarity, shops, minor gaps)
- Key findings that changed the plan:
  - Shop locations: NOT a bug — pipeline correct, game data genuinely sparse
  - FPS rarity: NOT 79% missing — loot_map already 94-100% for FPS (gap is ship_components at 3%)
  - Manufacturer NULL: IS the big problem — 4.6.0 extracted before manufacturer resolution existed
  - NPC loadouts: visible_item_count=0 for all v2 loadouts
- Phase 2: Fixed extraction scripts, re-extracted 4.6.0 data, applied to both environments
