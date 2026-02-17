# Session Journal

This file maintains running context across compactions.

## Current Focus

**Paint sync pipeline — COMPLETE.** scunpacked-data paint metadata + FleetYards paint images fully implemented and synced.

## Recent Changes

### Paint Sync Pipeline (2026-02-17)

**Implementation:**
- Created `internal/scunpacked/reader.go` — parses 988 paint JSON files from scunpacked-data, filters placeholders/non-ship paints, generates readable names from className when empty
- Created `internal/scunpacked/sync.go` — resolves vehicle_id from paint tags (exact slug → prefix LIKE → name CONTAINS), UPSERT with COALESCE to preserve images
- Extended `internal/fleetyards/client.go` — `FetchPaintImages()` for `/v1/models/{slug}/paints` endpoint
- Extended `internal/database/database.go` — 7 paint CRUD operations (UpsertPaint, UpdatePaintImages, GetAllPaints, GetPaintsForVehicle, GetPaintCount, GetVehicleSlugsWithPaints, GetPaintsByVehicleSlug)
- Extended `internal/database/migrations.go` — paints table columns (class_name UNIQUE, description, image_url_small/medium/large), scunpacked sync source seed
- Extended `internal/models/models.go` — Paint struct with ClassName, Description, 3 image size variants, joined vehicle fields
- Extended `internal/sync/scheduler.go` — `SyncPaints()` method: scunpacked metadata → FY paint images, name matching with normalization
- Extended `internal/api/router.go` — `GET /api/paints`, `GET /api/paints/ship/{slug}`, `POST /api/sync/paints`, paint count in status
- Extended `internal/config/config.go` — `SCUNPACKED_DATA_PATH` env var
- Updated `CLAUDE.md` — documented scunpacked package, paint sync pipeline, new env var

**Sync Results (fresh DB):**
- 796 paints parsed from 988 files (192 filtered: placeholders + non-ship)
- 753 matched to vehicles (94.6%) — 43 unmatched due to tag/slug mismatches
- 554 with images from FleetYards (69.6%) — FY doesn't have all paints
- 184/267 vehicles with images (68.9%) — same FY coverage limitation
- 561 paint images synced from FleetYards paint endpoints

**Gaps documented in review files:**
- `data/review-unmatched-paints.txt` — 43 paints: 890 Jump (3), Hornet Mk II variants (13), Mercury Star Runner (11), Ares Star Fighter (15)
- `data/review-paints-no-images.txt` — 242 paints without FY images
- `data/review-vehicles-no-images.txt` — 83 vehicles without FY images (mostly Wikelo specials, PYAM Execs, slug mismatches)

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

### FleetYards → SC Wiki Migration (2026-02-17)
1. **SC Wiki is now the sole data source** for ship specs, dimensions, pricing, production status, descriptions
2. **FleetYards retained for images only** — minimal client, `SyncImages()` overlays image URLs onto vehicles table
3. **No more FleetYards user settings** — removed from config, API, frontend, deployment manifests
4. **Bounded retry on API rate limits** — SC Wiki client retries max 3 times with context-aware sleep

### Previous Decisions
- LLM integration complete: AES-256-GCM encrypted keys, Claude/ChatGPT/Gemini, Settings page, AI insights on Analysis page
- SC Wiki API sync complete: manufacturers, vehicles, items, ports, game versions

## Important Context

- **Plan file:** `/home/gavin/.claude/plans/zazzy-bubbling-hammock.md` — full schema DDL, migration strategy, implementation phases 1-8
- **All SC Wiki sync phases were completed** before this redesign (but will need refactoring to target new tables)
- **All LLM integration was completed** (but settings/keys will move to user_llm_configs)
- **Owner:** Gavin, Senior QA at Pushpay, not a developer. FleetYards username: NZVengeance. 38 ships.
- **Tech:** Go 1.22, Chi router, SQLite/PostgreSQL, React SPA (Vite), Tailwind CSS


---
**Last compacted:** 2026-02-17 07:58:37


---
**Session compacted at:** 2026-02-17 11:51:50

