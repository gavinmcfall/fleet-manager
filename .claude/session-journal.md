# Session Journal

This file maintains running context across compactions.

## Current Focus

**Frontend auth + error handling fixes.** Root cause of "import completed but nothing shows": `postJSON` didn't check `res.ok`, so 401 from auth middleware was silently treated as success. Fixed `postJSON`/`putJSON`/`deleteJSON` to throw on non-OK responses, added `X-API-Key` header injection from localStorage token, and added API Token settings UI. Also fixed LLM GET routes (analysis-history, latest-analysis) to not require auth. All changes uncommitted — need to commit sync optimizations + these fixes, then deploy.

## Why Cloudflare Workers

Gavin already uses Cloudflare for DNS/CDN. Moving Fleet Manager to Workers eliminates self-hosting overhead (Docker, Helm, Flux GitOps, Talos node maintenance) and consolidates everything onto a platform he already pays for ($5/month Workers plan). The Go backend itself was fine — it's the deployment pipeline that was too heavy for a personal fleet tracker.

## CF Migration Progress

| Phase | Status | Commit | What it did |
|-------|--------|--------|-------------|
| 1. Project Scaffold + Database | DONE | `bcd3632` | Wrangler project, D1 schema (25 tables), TypeScript types, slug utilities |
| 2. Core Database Layer + API Routes | DONE | `3d1c3bd` | All D1 query functions (queries.ts), Hono API routes matching Go URL structure |
| 3. Frontend Integration | DONE | `ec86cab` | React SPA on Workers Assets, Cloudflare Vite plugin, SPA routing |
| 4. Sync Pipeline | DONE | `52ab50f` | SC Wiki, FleetYards, scunpacked (via GitHub API), RSI GraphQL sync |
| 5. Advanced Features | DONE | `24d51db` | AES-256-GCM encryption (Web Crypto), Anthropic LLM integration |
| Code Review Fixes | DONE | `2738509` | Auth, CORS, sync safety, import transactional, deduplication |
| 6. Deployment + Access Control | TODO | | Custom domain, WAF, secrets, CI/CD, go-live |

## Code Review Fixes Applied (commit `2738509`)

Consolidated findings from 3 independent AI reviewers (Opus, Codex, Gemini):

### Security
- Auth middleware with `X-API-Key` header / `token` query param on mutating endpoints
- CORS restricted to same-origin/localhost (was wildcard `*`)
- Analysis DELETE scoped to `user_id` (was unscoped)
- ENCRYPTION_KEY enforced in production for LLM API key storage

### Sync Safety
- 4 staggered cron triggers (3:00-3:45 UTC) instead of 1 monolithic sync
- `executionCtx.waitUntil()` on all sync POST handlers
- MAX_RETRIES=3 on scwiki 429 retry (was infinite recursion)
- GITHUB_TOKEN threaded to scunpacked GitHub API calls

### Import Safety
- Vehicle slugs preloaded into memory map (no per-entry DB queries)
- Transactional delete+insert via `db.batch()`
- Batch chunking at 90 statements for D1 limits

### Deduplication
- Shared `delay()` in `src/lib/utils.ts` (removed from 3 sync files)
- `getDefaultUserID` imported from queries.ts (removed from 4 route files)
- `getAllPaints`/`getPaintsForVehicle` imported from queries.ts (removed from paints.ts)
- Collapsed identical if/else in pipeline.ts
- Deduplicated `/with-insurance` handler in fleet.ts

## What Exists on `cf-rewrite` Branch

### New Workers code (`src/`)
- `src/index.ts` — Hono app entry + auth middleware + staggered cron handler
- `src/db/queries.ts` — All D1 query functions (~1000 lines)
- `src/routes/` — fleet, vehicles, paints, import, settings, sync, analysis, debug
- `src/sync/` — scwiki, fleetyards, scunpacked, rsi, pipeline
- `src/lib/types.ts` — All TypeScript interfaces (Env includes API_TOKEN, GITHUB_TOKEN)
- `src/lib/slug.ts` — Slug generation (port from Go)
- `src/lib/crypto.ts` — AES-256-GCM encryption (Web Crypto API)
- `src/lib/utils.ts` — Shared utilities (delay)
- `wrangler.toml` — D1 binding, 4 staggered cron triggers, Workers Assets
- `vite.config.ts` — Cloudflare Vite plugin

### Old Go code (NOT yet removed)
- `internal/` — All Go packages (api, database, sync, crypto, llm, analysis, etc.)
- `cmd/` — Go entrypoint
- `go.mod` / `go.sum` — Go dependencies
- `Dockerfile` — Docker build
- `helm/` — Helm chart for k8s deployment
- `frontend/` — Original React SPA (same code, now also served by Workers Assets)

## Key Decisions

- **Auth middleware**: `X-API-Key` header or `token` query param; no API_TOKEN = dev mode (allow all)
- **Encryption enforcement**: Production (API_TOKEN set) refuses plaintext LLM key storage; dev mode allows it
- **Staggered cron**: Each sync step is a separate cron invocation with its own 30s CPU budget
- **Embedded analysis prompt**: Workers have no filesystem — content embedded as const in analysis.ts
- **scunpacked via GitHub API**: Workers have no filesystem — fetch paint files via Git Trees API
- **Go code stays until Phase 6 verified**: Don't delete the working backend until replacement is proven

## Important Context

- **Branch:** `cf-rewrite` (7 commits ahead of main)
- **Plan file:** `/home/gavin/.claude/plans/proud-chasing-harbor.md`
- **Dev server:** `npx vite dev --port 5200`
- **D1 migrations:** Applied locally via `npx wrangler d1 migrations apply fleet-manager --local`
- **TypeScript:** Compiles clean (`npx tsc --noEmit`)
- **All API endpoints tested:** health, status, ships, vehicles, sync, settings, LLM routes all working

## What's Next — Phase 6

Deployment + Access Control:
- Custom domain: `fleet.nerdz.cloud` in wrangler.toml
- WAF IP restriction via Cloudflare Dashboard (hostname + IP allowlist)
- `wrangler secret put ENCRYPTION_KEY` (generate 32-byte base64 key)
- `wrangler secret put API_TOKEN` (generate strong token)
- GitHub Actions CI/CD with `cloudflare/wrangler-action@v3`
- Production deployment: `wrangler deploy`
- Run initial sync to populate D1
- Import HangarXplor data via the UI
- Verify everything works, then clean out old Go code

---
**Session compacted at:** 2026-02-18 20:27:04


---
**Session compacted at:** 2026-02-19 07:59:36


---
**Session compacted at:** 2026-02-20 09:31:12


---
**Session compacted at:** 2026-02-20 11:37:45


---
**Session compacted at:** 2026-02-20 12:24:42

