# Session Journal

## Current Focus
v2 pipeline: ALL GAPS CLOSED. 27 commits, 239 tests, 60+ tables.
4-agent parallel run closed P0-P3 simultaneously:
- P0: 76 ship component stat columns (13 sub-extractors)
- P1: 64 missiles with full stats
- P2: Consumable effects (87 types, ~200 links)
- P3: Vehicle prices, roles, salvage, fps_utilities, npc_factions
Pipeline running for final verification. Then D1 load.
Key docs: tools/docs/research/v1-vs-v2-gap-report-2026-04-02.md

## What's Next
1. Create fresh D1 test database and apply schema.sql
2. Load pipeline output to D1 (use batched API, not individual files)
3. Seed data extraction from prod (concept ships, insurance types, vehicle types)
4. Phase E: API sync engine (RSI Store, UEX, Cornerstone)
5. Phase F: Frontend/backend migration (remove game_version_id)

## Log

### 2026-04-01 11:00 — Completed: Schema alignment + local SQLite verification
- Fixed schema.sql to match all 50 pipeline output tables
- 5 new tables added (contract_rewards, npc_bundle_*, shop_item_links, world_placements)
- Column mismatches fixed across 22 tables (resistance, radiation, temperature, uuid, slug, etc.)
- 49/50 tables verified loading into local SQLite (loot_item_locations format verified, too slow for full local load without transaction wrapper)
- 3 schema commits: 4959f44, then batch fixes, then 07cdee4

### 2026-04-01 09:20 — Completed: v2 pipeline final run with fixes
- Full pipeline: 50 tables, 719,636 rows in 26 minutes
- shops: 103 (was 69, prod 87) — SOLD_AT edge fix captured orphaned shops
- vehicle_ports: 19,266 (was 4,960, prod 10,757) — recursive traversal + actors dir
- shop_item_links: 35,501 (was 24,114) — direct inventory links captured
- loot_item_locations: 560,682 (+11K from shop links)

### 2026-04-01 08:30 — Completed: Shops + vehicle_ports fixes
- Shops resolver: added SOLD_AT edge traversal for orphaned shops (18 extra)
- Vehicle ports: full rewrite with recursive traversal (MAX_DEPTH=6), PORT_CATEGORIES (300+ entries), actors dir (ATLS), category propagation
- All 193 tests pass, committed as 5d6b4d7

### 2026-04-01 07:30 — Completed: v2 pipeline final verification run
- Full pipeline run: 50 tables, 682,522 rows in 28 minutes (4.7.0-live)
- Graph: 83,692 nodes, 97,858 edges from 6 handlers
- Key wins vs prod (4.7.0-live only): loot_map +260%, missions +188%, contracts +550%, vehicle_components +64%, star_map +114%, weapon_racks +443%
- 15 entirely new tables not in prod (world_placements, shop_item_links, mining detail, etc.)
- 3 gaps investigated: vehicle_ports (fixed), shops (fixed), npc_loadout_items (not a gap — split tables)
- Production baseline captured per-version (4.6.0 and 4.7.0 separated)

### 2026-04-01 10:05 — Completed: UI prefs synced to DB (other session)
- Privacy mode, stealth %, font preference, sidebar collapsed now stored in user_settings
- 9 new backend tests, 250 total passing

### 2026-03-31 09:30 — Started: v2 extraction pipeline build
- Mallachi approved design doc at 09:07 via Discord
- 4-stage architecture: SCAN -> GRAPH -> ENRICH -> EMIT
- 12 commits building the pipeline from scratch
- Key docs: tools/docs/design/v2-implementation-plan.md
