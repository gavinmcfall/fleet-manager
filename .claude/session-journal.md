# Session Journal

This file maintains running context across compactions.

## Current Focus

**Code review plan — ALL TIERS COMPLETE.** 41-item code review implemented across 4 tiers. All commits pushed to origin. Server running locally on port 8080 with full data.

## Project State (2026-02-18)

| Metric | Before | After |
|--------|--------|-------|
| Vehicles | 267 | 267 |
| Vehicles with images | 255 (95.5%) | 184 (68.9%)* |
| Paints | 796 | 835 |
| Paints with images | 633 (79.5%) | 633 (75.8%) |
| Paints with vehicle links | 796 (100%) | 835 (100%) |
| Paint-vehicle links | 1,586 | 1,685 |
| Unmatched paints | 0 | 0 |

*Vehicle image count lower without RSI API enabled — run with `RSI_API_ENABLED=true` to restore full coverage.

## Recent Changes

### Code Review Plan Implementation (2026-02-18)

**Tier 1: Housekeeping** — commit `82721d2`
- Fixed Dockerfile Go version (1.22 → 1.24 to match go.mod)
- Removed `RawQuery`/`RawQueryRow` from database.go (C2 — SQL injection surface, zero callers)
- Cleaned `.env.example` (removed phantom LOG_LEVEL/DEBUG_ENABLED, added SCUNPACKED/RSI docs)
- Deleted stale 35MB `server` binary from repo root
- Cleaned `.env` (removed unused FLEETYARDS_USER)

**Tier 2: Critical Code Fixes** — commit `c0fbec5`
- C3: Made `encryptionKey` unexported in crypto package (was `EncryptionKey`)
- H2: Added fallback SELECT for `UpsertManufacturer`/`UpsertVehicle` when SQLite returns 0 on upsert-update
- H4: `GetDefaultUserID` now returns `(int, error)`; added `defaultUserID(w, ctx)` helper in router
- H5: Added `sync.Mutex` to prevent concurrent syncs — `TryLock()` for manual triggers, `Lock()` for cron/startup chain
- H6: Validate non-empty API key in `setLLMConfig` (was encrypting empty strings)
- H7: Added `http.MaxBytesReader` (1MB) to `setLLMConfig` and `testLLMConnection` endpoints
- M4: SPA path traversal fix — `filepath.Clean` + `filepath.Abs` + `strings.HasPrefix` check
- M5-M8: Added `io.LimitReader` to all HTTP clients (FleetYards 10MB, SC Wiki 10MB, RSI 10MB, Anthropic 1MB)
- L9: Added missing DB indexes: `paint_vehicles(vehicle_id)`, `user_fleet(user_id)`, `sync_history(started_at)`

**Tier 3: Data Quality Fixes** — commit `944dc25`
- Fixed 4 Khartu-al paints wrongly assigned to Cutter Scout (added `"scout": "khartu-al"` tag alias)
- Added `isPaintTag()` to handle non-standard tag formats (`Caterpillar_Paint`, `paint_golem`, `Ursa_Paint`, `Hull_C_Paint`, `paint_salvation`)
- Case-insensitive tag normalization in `resolveVehicleIDs`
- Added tag aliases for caterpillar, hull-c, golem, salvation, ursa
- Result: 40 previously skipped paints now sync correctly, paints 796→835, links 1586→1685

**Tier 4: Build, Verify, Push** — commit `054ad65`
- Build passes (`CGO_ENABLED=1 go build ./...`)
- Full sync verified with fresh DB
- All 10 commits pushed to origin/main

### Earlier Work (2026-02-15–18)

- Many-to-many paints refactor via `paint_vehicles` junction table
- FleetYards → SC Wiki migration (FY now images-only)
- Schema redesign (25 tables, 4 lookup tables)
- RSI extract image importer (static JSON files)
- RSI GraphQL API sync (live ship + paint images, public endpoint, no auth)

## Key Decisions

- **Generic `Paint_Hornet` → all Hornet variants**: Correct behavior — CIG made generic Hornet paints work on all variants
- **MXC/MTC mapping**: Same vehicle in-game, accept as-is
- **Non-standard tags**: Handle via `isPaintTag()` accepting both `Paint_X` and `X_Paint` + lowercase variants
- **`sync.Mutex` design**: Exported methods use `TryLock` (manual triggers return "sync already in progress"), cron/startup hold lock at chain level to avoid deadlock
- **`generateAIAnalysis` has no request body**: No `MaxBytesReader` needed — it reads fleet data from DB, not from the request

## Files Modified in Code Review

| File | Changes |
|------|---------|
| `Dockerfile` | Go 1.22 → 1.24 |
| `.env.example` | Removed phantom vars, added docs |
| `internal/database/database.go` | Removed RawQuery/RawQueryRow, H2 fallback SELECT, H4 GetDefaultUserID error return |
| `internal/database/migrations.go` | L9 indexes, renumbered migration steps |
| `internal/api/router.go` | H4 defaultUserID helper, H5/H6/H7/M4 fixes, MaxBytesReader |
| `internal/crypto/encryption.go` | C3 unexported encryptionKey |
| `internal/sync/scheduler.go` | H5 concurrent sync mutex |
| `internal/fleetyards/client.go` | M5 io.LimitReader |
| `internal/scwiki/client.go` | M6 io.LimitReader |
| `internal/rsi/client.go` | M7 io.LimitReader |
| `internal/llm/anthropic.go` | M8 io.LimitReader |
| `internal/scunpacked/reader.go` | isPaintTag() for non-standard tags |
| `internal/scunpacked/sync.go` | Scout alias, non-standard tag aliases, case-insensitive normalization |

## Important Context

- **Branch:** main, up to date with origin
- **Binary built:** `fleet-manager` in project root (CGO_ENABLED=1 required)
- **DB location:** `data/fleet-manager.db` (SQLite)
- **scunpacked-data repo:** `/home/gavin/cloned-repos/StarCitizenWiki/scunpacked-data/`
- **Owner:** Gavin, Senior QA at Pushpay, not a developer
- **Tech:** Go 1.24, Chi router, SQLite/PostgreSQL, React SPA (Vite), Tailwind CSS
- **Module path:** `github.com/nzvengeance/fleet-manager`
- **Full sync takes ~5-6 min** (SC Wiki rate-limited at 1 req/s, ~300 items across paginated endpoints)
- **Server currently running** on port 8080 with `SYNC_ON_STARTUP=true`, `RSI_API_ENABLED=false`

## Remaining Code Review Items (not implemented)

### Not addressed (from plan, lower priority):
- H3: Errors swallowed in `/api/status` — log + return 503 (partially addressed by H4)
- M1-M3, M9-M16: Medium-priority items (error leaking, CORS, SyncAll returns nil, etc.)
- L1-L8, L10-L14: Low-priority items (code duplication, hardcoded model list, etc.)
- Unit test coverage (zero unit tests)
- CI/CD pipeline
- Frontend code-splitting (747KB bundle)

## Sync Chain Order (startup)
1. SC Wiki: manufacturers → game_versions → vehicles → items
2. FleetYards: vehicle images
3. scunpacked: paint metadata (835 paints)
4. FleetYards: paint images
5. RSI API: ship + paint images (if `RSI_API_ENABLED=true`)
6. RSI extract: static fallback (only if API not enabled)

---
**Session compacted at:** 2026-02-18 19:19:53

