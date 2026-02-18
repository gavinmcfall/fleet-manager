# Session Journal

This file maintains running context across compactions.

## Current Focus

**RSI GraphQL API — COMMITTED.** All RSI API work committed in `fd2ac17`. Ship + paint images from public GraphQL, paint name matching with aliases/unicode/year-stripped fallback. 249 ship images, 321 paint images matched. Remaining 42 unmatched paints are ships not yet in DB (MOTH, Golem, MXC, etc.).

## Recent Changes

### RSI GraphQL API + Paint Matching (2026-02-18) — commit fd2ac17

**New files:**
- `internal/rsi/client.go` — Pure GraphQL client, no auth. `QueryGraphQL(ctx, query, vars)` with batched requests, 429 retry, rate limiting.
- `internal/rsi/parser.go` — `browseResource`/`browseResponse` types matching GraphQL shape.
- `internal/rsi/sync.go` — `SyncShipImages` + `SyncPaintImages` with pagination. `paintShipAliases` map expands RSI abbreviated ship names. `expandRSIPaintName()` applied before matching.

**Modified files:**
- `internal/rsi/import.go` — `normalizePaintName` now handles unicode diacritics (ā→a), curly apostrophes ('→'), spelling fixes (bushwacker→bushwhacker). `findPaintMatch` adds year-stripped fallback. New `stripYears()` and `yearRegex`.
- `internal/config/config.go` — Added `RSI_API_ENABLED`, `RSI_BASE_URL`, `RSI_RATE_LIMIT`
- `internal/sync/scheduler.go` — RSI API syncer integrated, runs after paints. Static extract is fallback only when API disabled.
- `internal/database/migrations.go` — Added sync_source `{5, "rsi_api", "RSI API (Images)"}`
- `CLAUDE.md`, `.env.example` — Updated docs and config

**Bugs fixed this session:**
- RSI API pagination: ships now return 30/page (ignoring `limit=100`). Changed break condition from `count < pageLimit` to `count == 0 || len >= totalCount`.
- Removed bad aliases ("100 series"→"100i", "c8 pisces"→"Pisces") that converted correct names into wrong ones.
- Added apostrophe normalization (U+2019→U+0027) for San'tok.yai Xua'cha match.

**Results:**
- Ships: 247 fetched, 202 matched, 47 inherited (249 total)
- Paints: 321 matched out of 363 individual (42 unmatched — ships not in DB)
- DB: 633/796 paints with images (79.5%), 255/267 vehicles with images

### RSI Extract Image Import (2026-02-17)

- `internal/rsi/import.go` — Reads RSI extract JSON files, matches to DB, updates image URLs
- Ship matching: direct name → fuzzy name map → manufacturer prefix strip → variant inheritance
- Paint matching: combine ship+paint name → normalize → exact/prefix/year-stripped match

### Earlier Changes (2026-02-15–17)

- Many-to-many paints refactor (paint_vehicles junction table)
- FleetYards → SC Wiki migration (FY now images-only)
- Schema redesign (25 tables, 4 lookup tables)
- Code review fixes (11 findings)

## Key Decisions

### RSI API Design (2026-02-18)
1. **Public GraphQL, no auth** — both ships and paints accessible without credentials
2. **Paint ship aliases** — RSI abbreviates ship names ("Ares" not "Ares Star Fighter"), alias map expands before matching
3. **RSI API overwrites FleetYards** — higher quality RSI CDN URLs take priority
4. **Static extract is fallback** — only runs when `RSI_API_ENABLED=false`

### Remaining 42 Unmatched Paints
- 28 ships not in scunpacked-data/DB: MOTH, Golem, MXC, Hull C, Lynx, Salvation, Caterpillar paints, Ursa, Archimedes
- ~14 edge cases: Auspicious Red year mismatches, Mk II discrepancies, MPUV-1T, CSV, Razor Mirai

### Previous Key Decisions
- SC Wiki is sole data source for ship specs
- FleetYards retained for images only
- Many-to-many paints via junction table
- HangarXplor is only user fleet source
- Insurance is typed (duration_months)

## Important Context

- **Binary built:** `fleet-manager` in project root (CGO_ENABLED=1 required)
- **DB location:** `data/fleet-manager.db` (SQLite)
- **scunpacked-data repo:** `/home/gavin/cloned-repos/StarCitizenWiki/scunpacked-data/`
- **Owner:** Gavin, Senior QA at Pushpay, not a developer
- **Tech:** Go 1.24, Chi router, SQLite/PostgreSQL, React SPA (Vite), Tailwind CSS
- **Module path:** `github.com/nzvengeance/fleet-manager`
- **Branch:** main, ahead of origin by 5 commits (not pushed)

## Sync Chain Order (startup)
1. SC Wiki: manufacturers → game_versions → vehicles → items
2. FleetYards: vehicle images
3. scunpacked: paint metadata (796 paints)
4. FleetYards: paint images
5. **RSI API: ship + paint images** — if `RSI_API_ENABLED=true`
6. RSI extract: static fallback — only if API not enabled

---
**Session compacted at:** 2026-02-18 17:01:54


---
**Session compacted at:** 2026-02-18 17:07:42

