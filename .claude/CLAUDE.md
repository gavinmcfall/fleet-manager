# SC Bridge — Project Context

## What This Is
A Star Citizen companion web app (`scbridge.app`). Tracks ships, fleet composition, insurance, loot
data, and item stats. Deployed as a Cloudflare Worker with a D1 database and React SPA frontend.

## Tech Stack
- **Backend:** TypeScript, Hono framework, Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite dialect), 144 migrations
- **Frontend:** React SPA (Vite), Tailwind CSS, Lucide icons, Recharts
- **Auth:** Better Auth v1.4.18 with Kysely D1 dialect
- **Deployment:** `wrangler deploy` via GitHub Actions on push to `main` or `staging`

## Architecture

### Backend (`/src/`)
- `index.ts` — Hono app entry point. Registers all routes and global middleware (CORS with pinned extension IDs, auth with user-status check, logging, security headers incl. CSP/HSTS, body size limit).
- `lib/types.ts` — `Env`, `HonoEnv`, shared TypeScript types
- `lib/auth.ts` — `createAuth(env)` factory; cached per isolate via WeakMap
- `lib/logger.ts` — Structured JSON logging to Workers Observability
- `lib/crypto.ts` — ENCRYPTION_KEY validation and use
- `lib/slug.ts` — Slug generation utilities
- `lib/utils.ts` — Shared utilities (`concurrentMap`, etc.)
- `lib/cfImages.ts` — Cloudflare Images upload helpers
- `lib/email.ts` — Email sending via Resend API
- `lib/constants.ts` — Shared constants
- `lib/change-history.ts` — User change history logging
- `lib/gravatar.ts` — Gravatar URL generation
- `lib/password.ts` — Password utilities
- `lib/rsi.ts` — RSI API client helpers
- `lib/validation.ts` — Zod input validation helpers (`validate` middleware wrapper, shared schemas)
- `lib/cache.ts` — KV read-through cache (`cachedJson`, `resolveVersionId`, `purgeByPrefix`, `cacheSlug`)
- `lib/fleet-import.ts` — Fleet/pledge import helpers (`executeFleetSwap`, `executeTableSwap`, vehicle matching)

### Routes (`/src/routes/`)
- `fleet.ts` — User fleet CRUD, ship custom names
- `vehicles.ts` — Vehicle reference data (specs, images, components)
- `paints.ts` — Paint variants
- `import.ts` — HangarXplor JSON import + hangar-sync extension import (insert-then-swap for all tables)
- `settings.ts` — User settings
- `sync.ts` — Trigger RSI image syncs
- `analysis.ts` — Fleet gap analysis, redundancy detection
- `account.ts` — Account management, email verification, 2FA
- `orgs.ts` — Organisation management (members-only visibility, no public profiles)
- `ops.ts` — Org Ops: structured operations with lifecycle, payouts, public join codes, ratings
- `reputation.ts` — Player reputation: public reputation summary per user
- `admin.ts` — Admin-only operations (CF Images bulk upload, invites, version management)
- `debug.ts` — `/api/debug/imports` — vehicle linkage, fleet counts
- `migrate.ts` — On-demand migration trigger
- `loot.ts` — Loot database, collection, wishlist, POI endpoints
- `contracts.ts` — Contract data
- `patches.ts` — Game version/patch endpoints
- `gamedata.ts` — Game reference data: shops, trade commodities, factions, laws, reputation, careers, missions, weapon racks, suit lockers, NPC loadouts

### Database (`/src/db/`)
- `queries.ts` — All D1 prepared statements. Single source of truth for DB access.
- `migrations/` — Sequential `NNNN_description.sql` files. Applied via `npx wrangler d1 migrations apply sc-companion --remote`.
- `CONVENTIONS.md` — Full DB conventions reference. Read this before writing any migration or query.

### Sync (`/src/sync/`)
- `rsi.ts` — RSI API sync: ship + paint images from public GraphQL API (ship image sync is a no-op — all ships have CF Images)
- `pipeline.ts` — Sync pipeline orchestration (RSI image sync only; paint metadata comes from DataCore extraction scripts, not live sync)

### Frontend (`/frontend/src/pages/`)
React SPA. 41 page components including: `Dashboard`, `FleetTable`, `ShipDB`, `ShipDetail`,
`Insurance`, `Analysis`, `AnalysisHistory`, `Insights`, `Import`, `Account/`, `LootDB/`, `POI`, `POIDetail`,
`Contracts`, `Orgs`, `OrgProfile`, `OrgSettings`, `Settings`, `Admin`, `UserManagement`,
`Login`, `Register`, `ForgotPassword`, `ResetPassword`, `TwoFactorVerify`, `VerifyEmail`,
`AcceptInvitation`, `Shops`, `TradeCommodities`, `LawSystem`, `Reputation`, `Careers`,
`MiningGuide`, `PaintBrowser`, `NPCLoadouts`, `ArmorSetDetail`, `Crafting/`, `About`,
`Privacy`, `Terms`, `NotFound`.

**Public pages** (no login required): All Game Data pages (loot, POI, contracts, shops, trade, mining, NPC loadouts), all Reference pages (ships, paints, careers, reputation, law), About, crafting.

**Feature-flagged**: Org Ops — hidden in production via `features.ops` from `/api/status` (ENVIRONMENT-based).

All filter/sort/pagination state uses URL query strings (`useSearchParams`) for deep-linking.

`LootDB/` is the first directory-based page decomposition:
- `index.jsx` — Main component (ambient collection/wishlist, category strip, stat cards, filters)
- `DetailPanel.jsx` — Item detail slide-over + stat helpers/constants + resistance bars
- `FullItemDetail.jsx` — Full page detail view for ship components (at `/loot/:uuid/detail`)
- `CategoryStrip.jsx` — Horizontal icon+label category pills with counts
- `CategoryStatConfig.js` — Per-category stat display configurations
- `ItemCard.jsx` — Category-aware cards with stats, manufacturer, collected overlay
- `ItemCardStats.jsx` — Category-specific stat zone renderer (DPS, resistance bars, size/grade)
- `ResistanceBar.jsx` — Color-coded horizontal resistance visualization
- `CompareDrawer.jsx` — Bottom-anchored compare drawer (max 3 same-category items)
- `CompareTable.jsx` — Side-by-side stat comparison with winner highlighting
- `InlineExpand.jsx` — Lightweight inline detail for simple items
- `LocationSection.jsx` — Location grouping (containers, NPCs, shops)
- `lootHelpers.js` — `extractSetName`, `resolveLocationEntry`, `buildShoppingList`, pagination constants
- `WishlistRow.jsx`, `CollectionStepper.jsx`, `SourceIcons.jsx` — Extracted sub-components

## Cron Jobs (wrangler.toml)

| Schedule | Task |
|----------|------|
| `30 3 * * *` | Session cleanup — expired sessions + verifications |
| `45 3 * * *` | RSI API images — ship + paint images from RSI GraphQL |

## Data Sources

| Source | What | When |
|--------|------|------|
| RSI GraphQL API | Ship + paint images from public store API | Nightly (3:45 AM cron) |
| HangarXplor JSON | User fleet: insurance, pledge cost/date | User-triggered import |
| DataCore (`/home/gavin/scbridge/tools/scripts`) | Component stats, FPS gear, loot map, paint metadata, weapon racks, suit lockers, NPC loadouts | One-time extract scripts |
| Game data p4k (`/mnt/e/SC Bridge/Data p4k`) | Raw extracted game files (XML, JSON) per version | Manual p4k extraction |

The game data p4k directory contains extracted Star Citizen game files organized by version
(e.g. `4.0.2-live.9428532`). Use the latest version folder. This is the ground truth for what
exists in-game — always check here before concluding an item doesn't exist.

## Documentation

All project documentation lives in the **private tools repo** at `/home/gavin/scbridge/tools/docs/`.
This includes assessments, research, designs, guides, and the remediation plan. **Do not create docs
in this repo** — create them in the tools repo instead.

| Directory | Contents |
|-----------|----------|
| `docs/assessment/` | Pre-v1.0.0 security & quality audit (2026-03-17, 18-agent audit) |
| `docs/research/` | Research artifacts (p4k data, extraction pipelines, API references, DB comparisons) |
| `docs/design/` | Design documents (KV caching strategy, quantum HUD, delta versioning) |
| `docs/guides/` | Operational guides (production go-live plan, staging test plan) |

## Security Architecture (from pre-v1.0.0 audit)
- **CORS**: Pinned extension ID allowlist (`TRUSTED_EXTENSION_ORIGINS` in `index.ts` + `TRUSTED_EXT_ORIGINS` in `auth.ts`). No wildcard extension origins.
- **Security headers**: CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy
- **Auth pipeline**: Session middleware checks user status in DB on every request (mitigates Better Auth 5-min cookie cache). Banned/deleted users are treated as unauthenticated immediately.
- **API token**: `X-API-Key` header only — no query string fallback
- **Body size limit**: 5MB max on `/api/*` via Content-Length check
- **ENCRYPTION_KEY**: Validation failure returns 503 (halts worker)
- **Rate limiting**: Cloudflare WAF rate limiting on `/api/auth/*` endpoints (3 req/10s per IP). In-app memory-based limiting is defense-in-depth only.
- **Account deletion**: Comprehensive — covers all 20+ user tables, scrubs IP addresses from change history, deletes org memberships
- **Org privacy**: All org endpoints (profile, fleet, stats, analysis, members) are members-only. Non-members get 404.
- **Cache keys**: User-supplied slugs sanitized via `cacheSlug()` before interpolation
- **Error responses**: Generic messages to clients, full details in server logs only
- **Input validation**: All mutation endpoints use Zod `validate()` middleware
- **Response contract**: Mutations return `{ ok: true }` or `{ ok: true, message }`. Errors return `{ error }`.

## Key Design Decisions
- **Game version management**: `lootBaseWhere(patchCode?)` replaces the old `LOOT_BASE_WHERE` constant. All loot endpoints accept `?patch=` query param. `GameVersionProvider` context provides `activeCode` to all loot hooks. Admins can set `adminPreviewPatch` in user settings to preview unreleased data (amber badge in sidebar). Public default version is managed via `PUT /api/admin/versions/default`.
- **Insert-then-swap import**: All import tables (fleet, pledges, pledge_items, pledge_upgrades, buybacks) use insert-then-swap: record MAX(id), insert new rows, delete old rows by id <= max. Prevents data loss on transient D1 failures.
- **Helmets merged into Armour (UX)**: The DB `loot_map.category` stays `'helmet'` but `effectiveCategory()` in `lootDisplay.js` maps it to `'armour'`. Helmets are just another armour piece to users (Core, Arms, Legs, Helmet, Backpack, Undersuit). The `fps_helmets` table stays separate in the DB (has `atmosphere_capacity` unique to helmets), but the frontend treats them as armour. Sub-filters let users drill into specific pieces.
- **No UNIQUE on user_fleet**: users can own multiples of the same ship (two PTVs, etc.).
- **RSI sync**: ship image sync is guarded by CF Images check (no-op for all ships). Paint image sync has no CF Images guard — fix before uploading paint CF Images.
- **Paints are many-to-many**: `paint_vehicles` junction table links paints to all compatible vehicles.
- **Insurance is typed**: `insurance_types` lookup table with `duration_months` (LTI, 120-month, etc.)
- **Better Auth org tables use camelCase** in D1: `organizationId`, `userId`, `createdAt`.
- **`createAuth(env)` is cached per isolate** via WeakMap — do not call unconditionally per request.
- **org_visibility values**: `'public' | 'org' | 'officers' | 'private'` (DEFAULT `'private'`). Org profiles, stats, fleet, and analysis are all members-only (non-members get 404). Future RSI verification flow for org ownership claims.
- **Shop location_label**: denormalized TEXT column on `shops` table (not FK). Handles template shops, removed locations like Port Olisar. Set via extraction script.
- **Trade commodities**: `trade_commodities.uuid` matches `shop_inventory.item_uuid` for admin shops. Prices are base defaults — in-game values are dynamic based on supply/demand.
- **stats_json fully eliminated**: All stat data migrated to typed columns. 0075–0092 handled 8 FPS/vehicle tables. 0097–0099 handled remaining 3 tables (mineable_elements, law_infractions, consumables). Zero `stats_json` columns remain in the schema. Extraction scripts output individual columns, not JSON blobs.
- **New FPS tables (0085–0087)**: `fps_melee` (knives), `fps_carryables` (carryable items), `fps_ammo_types` (ammo/magazine types). All version-keyed.
- **New mission/rep tables (0088–0091)**: `missions` (2,559 pu_missions), `reputation_perks`, `reputation_reward_tiers`, `mission_type_givers` (junction). Awaiting extraction scripts for population.
- **Vehicle weapon racks (0112)**: `vehicle_weapon_racks` — per-ship weapon storage from DataCore. Ports classified as rifle (sz 2-4) or pistol (sz 0-1). Vehicle matching via manufacturer code + name pattern.
- **Vehicle suit lockers (0113)**: `vehicle_suit_lockers` — per-ship suit storage from DataCore. Simpler than weapon racks — just entity name, UUID, and vehicle link.
- **NPC loadouts (0114)**: `npc_factions`, `npc_loadouts`, `npc_loadout_items` — 2,636 loadouts across 30 factions from CryXmlB XMLs + DataCore bundles. Items cross-referenced to `loot_map` via `class_name` matching. Denormalized columns: `resolved_name`, `loot_item_id`, `manufacturer_name`, `is_hidden`. `visible_item_count` precomputed on `npc_loadouts`. Extraction scripts: `npc_loadouts/extract.py` (character XMLs) + `npc_loadouts/extract_bundles.py` (DataCore bundles).
- **Loot item locations (0115)**: `loot_item_locations` junction table replaces 4 JSON blob columns (`containers_json`, `shops_json`, `npcs_json`, `contracts_json`) on `loot_map`. 1,088,220 rows. Indexed by `source_type`/`location_key`. POI queries use indexed JOINs instead of `json_each()`. DB size dropped from 92MB→18MB after column removal.
- **NPC perf + denormalize (0117-0119)**: `spawn_locations` column on `loot_item_locations`, `is_hidden` + `visible_item_count` on NPC tables, `resolved_name`/`loot_item_id`/`manufacturer_name` on `npc_loadout_items`.
- **Profile bio verification (0132)**: `profile_verification_pending` table + `verified_at`/`verified_handle` on `user_rsi_profile`. Partial unique index prevents two users verifying same handle. Verification cleared on handle change via RSI sync. 3 endpoints: generate key, check citizen page HTML, status query.
- **Org Ops (0133)**: 7 tables: `op_types`, `org_ops`, `org_op_participants`, `org_op_ships`, `org_op_capital`, `org_op_earnings`, `org_op_payouts`. Lifecycle: planning→active→completed→archived (or cancelled). Payout: ratio × time proration. `is_public` + `join_code` for public ops. `webhook_url` column reserved for future Discord integration. Ships linked to `user_fleet` entries. `opsRoutes()` mounted as sub-router on `orgRoutes` at `/:slug/ops`. `publicOpsRoutes()` mounted at `/api/ops` for join-by-code.
- **Player reputation (0134)**: 4 tables: `rating_categories`, `player_ratings`, `player_reviews`, `rating_audit_log`, `player_reputation` (materialized medians). Semi-anonymous: users see aggregates, admins see everything. Requires verified account + 7-day account age. IP tracked on every rating. Median recalculated on each INSERT.
- **Stable PTU versions (0140)**: PTU/EPTU `game_versions` rows use stable codes without build numbers (e.g., `"4.7.0-ptu"` not `"4.7.0-ptu.11475995"`). Build number tracked in separate `build_number` column. User preferences survive PTU data refreshes. Admin purge endpoint (`DELETE /api/admin/versions/ptu`) wipes all PTU data from ~65 versioned tables; build update endpoint (`PUT /api/admin/versions/ptu/build`) sets the build number. Extraction scripts use `lib/version.py:resolve_version()` to produce stable PTU codes. The `getGameVersions` EXISTS check naturally hides purged PTU entries (no data = not in dropdown).
- **KV caching**: `SC_BRIDGE_CACHE` KV namespace. `cachedJson()` helper in `src/lib/cache.ts` wraps 25 public endpoints with read-through KV cache. Cache keys: `{domain}:{resource}:{versionId}[:{qualifier}]`. User-supplied slugs sanitized via `cacheSlug()` to prevent namespace collision. 24-hour TTL safety net. Auto-purge on game version change (`PUT /api/admin/versions/default`). Manual purge via `POST /api/admin/cache/purge` (optional `{ prefix }` body). `X-Cache: HIT/MISS` + `X-Cache-Key` headers for observability. User-data endpoints (fleet, settings, collection) are never cached. Design doc at `/home/gavin/scbridge/tools/docs/design/kv-caching-strategy.md`.

## Build & Deploy
```bash
# Type check
npm run typecheck

# Build — root vite build compiles worker + frontend into dist/
# Production deploys read from dist/client/ (via @cloudflare/vite-plugin).
# Staging deploys read from frontend/dist/ (via wrangler.toml [assets] directory).
npm run build

# Deploy PRODUCTION — ALWAYS use --env production
# Running without --env will fail (no top-level bindings — safety net).
source ~/.secrets && cf-scbridge
npx wrangler deploy --env production --config wrangler.toml

# Deploy STAGING — MUST build frontend separately
# wrangler.toml [assets] points to frontend/dist/, NOT dist/client/.
# The root `npm run build` does NOT update frontend/dist/ — you must build it explicitly.
source ~/.secrets && cf-scbridge
cd frontend && npm run build && cd ..
npx wrangler deploy --env staging --config wrangler.toml

# Migrations (production)
source ~/.secrets && cf-scbridge && npx wrangler d1 migrations apply scbridge-production --remote --env production

# Migrations (staging)
source ~/.secrets && cf-scbridge && npx wrangler d1 migrations apply scbridge-staging --remote --env staging
```

## Testing (DO NOT SKIP)

**Tests gate deployment.** CI will NOT deploy if any test fails. Pre-commit hooks run tests locally.
Do not bypass hooks with `--no-verify`. Do not mark tests as skipped to make the suite pass.

### TDD Rules (MANDATORY)

1. **Write the test BEFORE the fix.** If you're fixing a bug, write a test that reproduces it first. Then fix the code. Then verify the test passes. No exceptions.
2. **Run tests BEFORE declaring done.** Every change must be validated with `npx vitest run` (backend, from repo root) and `cd frontend && npx vitest run` (frontend). Both must pass.
3. **Never claim "it works" without test evidence.** If a test doesn't exist for the behavior you changed, you haven't verified it. Write the test.
4. **No data changes without validation.** Before applying SQL to any database, verify: row counts before/after, no duplicate UUIDs, no stale data overwriting newer data.

### Test Infrastructure

| Layer | Command | Tests | What it covers |
|-------|---------|-------|---------------|
| Backend (vitest) | `npx vitest run` | 181 | API endpoints, DB queries, auth, loadout golden data |
| Frontend (vitest) | `cd frontend && npx vitest run` | 46 | Formatters, component rendering, business logic |
| E2E (Playwright) | `npx playwright test` | 30+ | Full page rendering against staging |
| Smoke (Playwright) | `npx playwright test --config playwright.smoke.config.ts` | 13 | Post-deploy staging health |
| Tools (pytest) | `cd /home/gavin/scbridge/tools/scripts && python3 -m pytest tests/ -m "not p4k"` | 132 | Extraction script pure functions, PORT_CATEGORIES ordering |
| Tools golden (pytest) | `python3 -m pytest tests/ -m p4k` | 28 | Ship port/combat stats extraction against real p4k data |

### Pre-commit Hooks

- **Fleet-manager:** husky runs `npm run typecheck && npx vitest run` (~18s)
- **Tools repo:** `.githooks/pre-commit` runs `pytest tests/ -m "not p4k"` (~0.1s)

### CI Pipeline (deploy.yml)

```
test job (MUST pass) → deploy job → smoke-test job (staging only)
```

Tests are NOT advisory. They block deployment. The `continue-on-error` flag was intentionally removed.

### Adding New Tests

When adding a new feature or fixing a bug:
1. Backend API change → add/update test in `test/*.test.ts`
2. Frontend component change → add/update test in `frontend/src/**/*.test.jsx`
3. Loadout query change → verify `test/loadout.test.ts` still passes (Asgard golden data)
4. Extraction script change → add test in `tools/scripts/tests/`, run golden tests locally before data load

## Environments

### Cloudflare Accounts

SC Bridge is migrating from Gavin's personal NERDZ account to a dedicated team account.

| Account | ID | Purpose |
|---------|-----|---------|
| **NERDZ** (legacy) | `4214879ee537a4840de659aafb7bf201` | Personal projects. SC Bridge resources being migrated off. |
| **SC Bridge** (new) | `92557ddeffaf43d64db74acf783ec49d` | Dedicated SC Bridge team account. |

**Naming convention (new account):** `scbridge-{environment}` — no version suffixes.
- D1: `scbridge-production` / `scbridge-staging`
- R2: `scbridge-avatars-production` / `scbridge-avatars-staging`
- KV: `scbridge-cache`
- Workers: `scbridge` / `scbridge-staging`

**Shell profile switcher:** `cf-scbridge` / `cf-nerdz` / `cf-which` functions in `~/.zshrc`.
Run wrangler from `/tmp` when targeting SC Bridge account (avoids wrangler.toml account_id override).

### Production (NERDZ — current, migrating)
- **Worker:** `sc-bridge` → `scbridge.app`
- **D1:** `sc-companion-v2` (`0f2fd623-0a47-492b-aa43-0773cced850b`)
- **R2:** `sc-bridge-avatars`
- **Deploy trigger:** push to `main`

### Production (SC Bridge — new)
- **D1:** `scbridge-production` (`673a1493-df10-4fe2-bc39-e24b649c538f`)
- **R2:** `scbridge-avatars-production`
- **KV:** `SC_BRIDGE_CACHE` (`608aaea06e2b4177b7e824a05e680ff3`)

### Staging (NERDZ — current, migrating)
- **Worker:** `sc-bridge-staging` → `staging.scbridge.app`
- **D1:** `sc-companion-staging-v2` (`210c084b-6e14-415f-af45-46157e5d53a5`)
- **R2:** `sc-bridge-avatars-staging`
- **Deploy trigger:** push to `staging` branch
- **Crons:** disabled (empty array)
- **RSI sync:** disabled (`RSI_API_ENABLED = "false"`)
- **Note:** Better Auth tables (`user`, `session`, `account`, etc.) were bootstrapped manually on the staging DB since they're created by Better Auth at runtime, not by migration files. If the staging DB is ever recreated, run the bootstrap SQL before applying migrations.

### Staging (SC Bridge — new)
- **D1:** `scbridge-staging` (`8c8f8bb9-f8c4-4cd2-a696-831d094fcb7a`)
- **R2:** `scbridge-avatars-staging`
- **KV:** `SC_BRIDGE_CACHE_STAGING` (`c43dfff89ae445a897916dc8e3fa7967`)

### Staging-Only Deploy Rule (DO NOT BREAK THIS)
When the user says "push to staging", they mean **staging ONLY** — do NOT push to main.
The correct workflow for staging-only deploys:
1. Commit changes on the current branch (main or a feature branch)
2. Push ONLY to the staging branch: `git push origin HEAD:staging`
3. Do NOT run `git push origin main` unless the user explicitly says "push to main" or "push to production"
4. If in doubt, ASK before pushing to main

### Staging Deploy Gotcha
The `@cloudflare/vite-plugin` generates a redirect config at `.wrangler/deploy/config.json` → `dist/sc_bridge/wrangler.json`. This flattened config does NOT support `--env`. Always use `--config wrangler.toml` for staging deploys.

## Wrangler Config (`wrangler.toml`)
- **Account:** NERDZ (`4214879ee537a4840de659aafb7bf201`) — will be updated to SC Bridge after migration
- **Assets dir:** `./frontend/dist` (with `run_worker_first = true`)

---

## DB Schema Rules (DO NOT BREAK THESE)

Full conventions are in `src/db/CONVENTIONS.md`. The rules below are the critical ones that
have caused bugs before or are easy to get wrong.

### Naming
- Table names: `snake_case`, plural (`vehicles`, `fps_weapons`, `vehicle_components`)
- Namespaces: `vehicle_*` for ship items, `fps_*` for personal gear, `user_*` for user data
- No namespace prefix for core entities (`vehicles`, `paints`, `manufacturers`)
- Functions in `queries.ts`: match the table name — `buildUpsertVehicleComponentStatement` for `vehicle_components`

### Schema
- PK: always `id INTEGER PRIMARY KEY AUTOINCREMENT` — never UUID as PK
- UUIDs: separate `uuid TEXT NOT NULL UNIQUE` column when the row has a game-side UUID
- FKs: `{singular_table}_id INTEGER REFERENCES {table}(id)` — e.g., `manufacturer_id`, `fps_weapon_id`
- Junction tables: `{table1}_{table2}` alphabetically — e.g., `paint_vehicles` (not `vehicle_paints`)
- JSON blobs: `{field}_json TEXT` suffix — e.g., `containers_json`. (`stats_json` fully eliminated in 0092 + 0099)
- Resistance columns: `resist_` prefix — e.g., `resist_physical`, `resist_energy` (REAL 0.0–1.0)
- Booleans: `INTEGER DEFAULT 0` (0 = false, 1 = true)
- Timestamps: `TEXT DEFAULT (datetime('now'))` — ISO 8601

### Migrations
- Files: `src/db/migrations/NNNN_description.sql` — sequential, zero-padded 4-digit
- Apply (prod): `source ~/.secrets && npx wrangler d1 migrations apply sc-companion-v2 --remote`
- Apply (staging): `source ~/.secrets && npx wrangler d1 migrations apply sc-companion-staging-v2 --remote --env staging`
- Never skip numbers. Never rename an applied migration file.
- **Never ALTER a PK or UNIQUE constraint in-place** — create new table, copy data, drop old.
- Index naming: `idx_{table}_{column}` — e.g., `idx_loot_map_type`
- Current last migration: **0150_version_key_reference_tables.sql**

### Out-of-Band Columns
Previously these columns were applied via `wrangler d1 execute` outside migration files.
As of migration `0037_patch_versioning`, all tables were rebuilt and these columns are now
included in migration files. No current out-of-band columns exist.

---

## Image Data Rules (DO NOT BREAK THESE)

Image data is fragile. RSI API sync runs nightly and will silently overwrite if these rules
are violated.

### Priority Order
CF Images > RSI new CDN > RSI old CDN > SC Wiki relative path > NULL

Higher-priority images must **never** be overwritten by lower-priority ones.

### vehicle_images is the source of truth
- Every row in `vehicles` MUST have a corresponding row in `vehicle_images`
- `buildUpdateVehicleImagesStatement` uses INSERT ... ON CONFLICT DO UPDATE — never revert to plain UPDATE
- When migrations insert new vehicles, always follow with INSERT OR IGNORE into `vehicle_images`

### vehicles.image_url* must stay absolute
- SC Wiki provides relative `/media/...` paths — these must NEVER overwrite an absolute `https://` URL
- The CASE expression in `upsertVehicle` and `buildUpsertVehicleStatement` checks `LIKE 'http%'` before replacing
- Never simplify the image COALESCE — `COALESCE(excluded.image_url, vehicles.image_url)` would allow relative paths to overwrite absolute ones

### URL formats
- CF Images: `https://imagedelivery.net/{hash}/{imageId}/public`
- RSI new CDN: `https://robertsspaceindustries.com/i/{hash}/resize(...)/filename.webp`
- RSI old CDN: `https://media.robertsspaceindustries.com/{mediaID}/store_{size}.{ext}`
- SC Wiki relative: `/media/{mediaID}/store_small/{filename}.jpg` — NOT valid as `image_url`

---

## Evidence-First Rule (DO NOT BREAK THIS)

**NEVER make a statement about data without querying the actual data first.**

- Before claiming "X doesn't exist" → `SELECT` it and show the result
- Before claiming "script Y doesn't do Z" → read the code and cite the line number
- Before claiming "the cause is X" → show evidence from DB + code
- No "likely", "probably", or "I think" when facts are queryable
- Present findings like court evidence: source, query, result, conclusion
- If you don't know → say so, then investigate. Do not speculate.

This rule exists because unfounded assumptions wasted time and increased stress during a critical deadline.

---

## Owner Context
- Gavin — Senior QA at Pushpay
- Homelab: TalosOS Kubernetes cluster, Flux GitOps, BJW-S app-template
- GitHub: `SC-Bridge/sc-bridge`
- Has 38 ships including custom-named ones (Jean-Luc = Carrack, James Holden = Idris-P)
