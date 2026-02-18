# Session Journal

This file maintains running context across compactions.

## Current Focus

**Code review plan — Tiers 1-3 COMPLETE.** Implementing 41-item code review plan. Tier 1 (housekeeping) and Tier 2 (critical fixes) committed. Tier 3 (data quality) committed. Tier 4 (build, verify, push) pending — waiting on full sync verification.

## Recent Changes

### Tier 3: Data Quality Fixes (2026-02-18) — commit 944dc25

- Fixed Khartu-al paints wrongly assigned to Cutter Scout (added `"scout": "khartu-al"` alias)
- Added `isPaintTag()` to handle non-standard tag formats (`Caterpillar_Paint`, `paint_golem`, etc.)
- Case-insensitive tag normalization in `resolveVehicleIDs`
- Added aliases for caterpillar, hull-c, golem, salvation, ursa (40 previously skipped paints)

### Tier 2: Critical Code Fixes (2026-02-18) — commit c0fbec5

- C3: Made `encryptionKey` unexported in crypto package
- H2: Added fallback SELECT for UpsertManufacturer/UpsertVehicle on SQLite upsert-update
- H4: `GetDefaultUserID` now returns `(int, error)` with `defaultUserID` helper in router
- H5: Concurrent sync mutex with `TryLock()` for manual triggers
- H6: Validate non-empty API key in `setLLMConfig`
- H7: Added `http.MaxBytesReader` (1MB) to LLM endpoints
- M4: SPA path traversal fix with `filepath.Clean` + prefix check
- M5-M8: Added `io.LimitReader` to all HTTP clients
- L9: Added DB indexes on `paint_vehicles.vehicle_id`, `user_fleet.user_id`, `sync_history.started_at`

### Tier 1: Housekeeping (2026-02-18) — commit 82721d2

- Fixed Dockerfile Go version (1.22 → 1.24)
- Removed `RawQuery`/`RawQueryRow` (SQL injection surface, zero callers)
- Cleaned `.env.example` (removed phantom vars, added SCUNPACKED/RSI docs)
- Deleted stale `server` binary

## Key Decisions

- Generic `Paint_Hornet` → all Hornet variants: Correct behavior (game allows cross-variant paints)
- MXC/MTC mapping: Same vehicle, accept as-is
- Non-standard tags (`X_Paint`, `paint_x`): Handle via `isPaintTag()` + case-insensitive normalization
- `sync.Mutex` with `TryLock()`: Exported methods use TryLock for manual triggers, cron holds lock at chain level

## Important Context

- **Branch:** main, ahead of origin by 9 commits (not pushed)
- **Binary built:** `fleet-manager` in project root (CGO_ENABLED=1 required)
- **DB location:** `data/fleet-manager.db` (SQLite)
- **scunpacked-data repo:** `/home/gavin/cloned-repos/StarCitizenWiki/scunpacked-data/`
- **Owner:** Gavin, Senior QA at Pushpay, not a developer
- **Tech:** Go 1.24, Chi router, SQLite/PostgreSQL, React SPA (Vite), Tailwind CSS
- **Module path:** `github.com/nzvengeance/fleet-manager`
- **Full sync takes ~5 min** (SC Wiki rate-limited at 1 req/s, ~300 items across paginated endpoints)

## Commits to Push (9 total)

1. `fd2ac17` feat: add RSI GraphQL API sync for ship + paint images
2. `2369d07` chore: update session journal
3. `ab0cb65` chore: remove node_modules from git tracking
4. `32af03f` feat: import RSI extract images for ships and paints
5. `e53d73d` feat: many-to-many paints via paint_vehicles junction table
6. `8f3b556` chore: update session journal
7. `82721d2` fix: tier 1 housekeeping — Dockerfile Go version, remove RawQuery, clean .env.example
8. `c0fbec5` fix: tier 2 critical code fixes — security, robustness, data integrity
9. `944dc25` fix: paint-to-vehicle data quality — Khartu-al, non-standard tags
