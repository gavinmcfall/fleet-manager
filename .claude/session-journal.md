# Session Journal

This file maintains running context across compactions.

## Current Focus

**Many-to-many paints + tag alias map — COMPLETE.** Replaced single `vehicle_id` FK on paints with `paint_vehicles` junction table. All 796 paints now matched (was 753/43 unmatched).

## Recent Changes

### Many-to-Many Paints Refactor (2026-02-17)

**Implementation:**
- `internal/models/models.go` — Added `PaintVehicle` struct, replaced `VehicleID`/`VehicleName`/`VehicleSlug` with `Vehicles []PaintVehicle`
- `internal/database/migrations.go` — Removed `vehicle_id` from paints table, added `paint_vehicles` junction table, no-op'd `migratePaintsAddColumns`
- `internal/database/database.go` — Rewrote `UpsertPaint` (no vehicle_id, SQLite LastInsertId fallback), added `SetPaintVehicles`, `FindVehicleIDsBySlugLike/Prefix/NameContains`, rewrote `GetAllPaints`/`GetPaintsForVehicle`/`GetVehicleSlugsWithPaints` with two-query + index-map pattern
- `internal/scunpacked/sync.go` — Added `tagAliases` map (890j→890-jump, star-runner→mercury-star-runner, etc.), `resolveVehicleIDs()` returns `[]int`, deleted old helpers
- `internal/scunpacked/reader.go` — Fixed space-separated RequiredTags (take first Paint_ tag)

**Sync Results (fresh DB):**
- 796 paints, **0 unmatched** (was 43)
- 1586 paint_vehicles rows (many-to-many working)
- Aurora paints → 5 vehicles each, Hornet paints → 15 vehicles, 890 Jump → resolved via alias

**API response shape change:**
- `"vehicle_id": 5, "vehicle_name": "Aurora CL"` → `"vehicles": [{id, name, slug}, ...]`

### FleetYards → SC Wiki Migration + Code Review (2026-02-17)

**Migration (Plan Phases 2-4):**
- Extended SC Wiki models with dimensions, MSRP, production status, description, foci, loaners, SKUs
- Updated SC Wiki sync to populate all fields FY used to provide (except images)
- Renamed `FleetYardsURL` → `PledgeURL` in models, DB queries, and migrations
- Gutted FleetYards client to image-only (`ShipImages` struct, stripped `apiShip`)
- Renamed `SyncShips()` → `SyncImages()` in scheduler
- Added `UpdateVehicleImages()` DB function
- Removed FY settings routes, handlers, config (`FleetYardsUser`), frontend panels
- Updated CLAUDE.md, .env.example, docker-compose.yml, Makefile, helmrelease.yaml

**Code Review Fixes (11 findings):**
1. Removed committed binaries from git tracking (fleet-manager binary, DB file, frontend/dist)
2. PostgreSQL seed compatibility — `insertIgnore()` + `placeholders()` helpers for dialect-aware INSERT
3. Added `rows.Err()` checks after iteration in `GetAllVehicles`, `GetUserFleet`, `GetLatestSyncHistory`
4. CORS restricted from wildcard `*` to `s.cfg.BaseURL`
5. `GetAppSetting` now only suppresses `sql.ErrNoRows`, surfaces real DB errors
6. `ResolveManufacturerID` — deterministic `ORDER BY name`, `defer rows.Close()`, scan error logging
7. `writeJSON` — encoder errors now logged via `log.Warn()`
8. Insurance type resolution — per-key warning logging for missing seed data
9. `frontend/dist/` added to .gitignore and untracked
10. `SaveAIAnalysis` — PostgreSQL `RETURNING id` path added
11. SC Wiki client — bounded retry (max 3) with context-aware sleep on 429
12. **Bonus:** ShipDB.jsx production status comparison fixed (`flight-ready` → `flight_ready`)

### Schema Redesign Implementation (2026-02-15)
- **Phase 1:** Schema + Migration Infrastructure — 24 tables, 4 lookup tables seeded
- **Phase 2:** SC Wiki Sync refactored to target new tables, V2 dead code removed
- **Phase 3:** FleetYards Reference Sync — images overlay onto unified vehicles table
- **Phase 4:** User Data Layer — users, user_fleet, user_llm_configs CRUD
- **Phase 5:** Import Pipeline — HangarXplor writes to user_fleet, auto-enrichment via FK JOINs
- **Phase 6:** API Endpoints — all handlers query new schema
- **Phase 7:** Frontend Updates — useAPI.js, Dashboard, FleetTable, Insurance, Import pages updated for new flat data shapes
- **Phase 8:** Cleanup — deleted V2 files, unused functions, fixed PostgreSQL bug in migrations
- **Phase 9:** Build and Verify — end-to-end testing complete

### Bugs Fixed During Verification
- NULL column scan crash: `v.Size`, `v.Length`, `v.Cargo`, etc. scanned into Go `int`/`float64` from nullable DB columns. Fixed with `sql.NullInt64`/`sql.NullFloat64` in `GetAllVehicles()` and `GetVehicleBySlug()`
- Empty fleet returns `null` instead of `[]`: Fixed `listUserFleet` handler
- Insurance type parsing: Added `Insurance` field to `HangarXplorEntry` model, import now resolves "120-Month Insurance", "6-Month Insurance" etc. to typed insurance_type_id
- PostgreSQL compatibility: Fixed `migrationAIAnalyses` hardcoded AUTOINCREMENT

### Previous Changes
- Fixed Insurance.jsx infinite re-render (React error #310)
- Comprehensive schema redesign plan written

## Key Decisions

### Database Schema Redesign (2026-02-15)
1. **Drop `sc_` prefix** on core tables — manufacturers, vehicles, items are core data not foreign
2. **Unified vehicles table** — merges old `ships` (FleetYards) + `sc_vehicles` (SC Wiki) into one table
3. **`user_fleet` join table** — replaces old `vehicles` + `hangar_imports`. Links users to vehicle reference data. Insurance, pledge data, custom names live here.
4. **Individual lookup tables** (not generic OTLT) — `vehicle_types`, `insurance_types`, `sync_sources`, `production_statuses`
5. **Insurance is now typed** — `insurance_types` table with duration_months (LTI, 120-month, 6-month, etc.) replaces lossy boolean
6. **Items junk drawer split** — `components` (ship), `fps_weapons`, `fps_armour`, `fps_attachments`, `fps_ammo`, `fps_utilities`
7. **FleetYards role changed** — reference data only (images, paints). **Hangar sync removed entirely**. No more user fleet from FleetYards.
8. **HangarXplor is the only user fleet source** — auto-enriched from reference tables, no separate enrichment step
9. **Multi-user ready** — `users` table with default user on first boot. LLM keys in `user_llm_configs` tied to user_id.
10. **Paints table** — all paints in game, linked to vehicle_id. `user_paints` tracks ownership. `user_fleet.equipped_paint_id` tracks equipped.
11. **Migration strategy** — rename old tables to `old_*`, create new schema, migrate data, drop old tables

### Paint Sync Design Decisions (2026-02-17)
1. **Three-source pipeline:** scunpacked-data (metadata) → DB UPSERT → FleetYards (images overlay)
2. **COALESCE-based UPSERT on class_name** — scunpacked metadata and FY images never overwrite each other
3. **Tag-to-vehicle matching strategy:** normalize tag (strip `Paint_` prefix/`_Paint` suffix, `_` → `-`, lowercase) → exact slug → LIKE prefix → name CONTAINS
4. **Paint name matching for FY images:** normalize both names (lowercase, strip "livery"/"paint"/"skin" suffixes), try exact then substring match
5. **`data/p4k/` deleted** — 2.7GB unused game dump, replaced by targeted scunpacked-data reads
6. **scunpacked-data lives externally** at `/home/gavin/cloned-repos/StarCitizenWiki/scunpacked-data/` — configured via `SCUNPACKED_DATA_PATH` env var, disabled when empty

### Known Paint Sync Gaps (for future improvement)
- **All 43 previously unmatched paints now resolved** via tag aliases + many-to-many
- **9 FY 404s on paint fetch** — slug mismatches: 600i, a2-hercules-starlifter, csv-smn, dragonfly, esperia-stinger, f8a-lightning, hornet-f7a-mk-ii-pyam-exec, m50-interceptor, santokyai
- **Broken localisation strings** — some paints have `@item_Name...` prefixes instead of readable names (game data issue)

### FleetYards → SC Wiki Migration (2026-02-17)
1. **SC Wiki is now the sole data source** for ship specs, dimensions, pricing, production status, descriptions
2. **FleetYards retained for images only** — minimal client, `SyncImages()` overlays image URLs onto vehicles table
3. **No more FleetYards user settings** — removed from config, API, frontend, deployment manifests
4. **Bounded retry on API rate limits** — SC Wiki client retries max 3 times with context-aware sleep

### Previous Decisions
- LLM integration complete: AES-256-GCM encrypted keys, Claude/ChatGPT/Gemini, Settings page, AI insights on Analysis page
- SC Wiki API sync complete: manufacturers, vehicles, items, ports, game versions

## Important Context

- **Plan file:** `/home/gavin/.claude/plans/zazzy-bubbling-hammock.md` — paint sync plan (COMPLETED), schema redesign plan
- **scunpacked-data repo:** `/home/gavin/cloned-repos/StarCitizenWiki/scunpacked-data/` — 988 paint files at `items/paint_*.json`
- **Database is fresh and fully populated** — deleted corrupt DB and ran full sync chain on 2026-02-17
- **DB location:** `data/fleet-manager.db` (17MB, SQLite)
- **Binary built:** `fleet-manager` in project root (CGO_ENABLED=1 required for SQLite)
- **Review files in `data/`** — 3 gap analysis files (not tracked in git) for Gavin to review
- **Owner:** Gavin, Senior QA at Pushpay, not a developer. FleetYards username: NZVengeance. 38 ships.
- **Tech:** Go 1.24, Chi router, SQLite/PostgreSQL, React SPA (Vite), Tailwind CSS
- **Module path:** `github.com/nzvengeance/fleet-manager`

## Sync Chain Order (startup)
1. SC Wiki: manufacturers → game_versions → vehicles (288) → items (2818)
2. FleetYards: vehicle images (232 updated)
3. scunpacked: paint metadata (796 paints, 753 matched)
4. FleetYards: paint images (561 synced, 89 vehicles queried)

## Current DB State (2026-02-17)
| Table | Count |
|-------|-------|
| Manufacturers | 124 |
| Vehicles | 267 |
| Components | 1,354 |
| FPS Weapons | 394 |
| Game Versions | 1 |
| Paints (total) | 796 |
| Paints (matched) | 796 (100%) |
| Paint-Vehicle links | 1,586 |
| Paints (with images) | 554 (69.6%) |
| Vehicles (with images) | 184 (68.9%) |

---
**Last compacted:** 2026-02-17 07:58:37

---
**Session compacted at:** 2026-02-17 11:51:50

---
**Session compacted at:** 2026-02-17 14:11:24


---
**Session compacted at:** 2026-02-17 14:29:15

