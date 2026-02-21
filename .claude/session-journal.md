# Session Journal

This file maintains running context across compactions.

## Current Focus

**CF migration complete. All phases done. Testing & polish phase next.**

## Migration Status — COMPLETE

All 6 phases done. `cf-rewrite` merged to `main` via PR #1. Old Go code removed. CI/CD green.

| Item | Status |
|------|--------|
| Workers backend (Hono + D1) | Done — `src/` |
| Frontend (React SPA on Workers Assets) | Done — `frontend/` |
| Component library (10 shared components) | Done — `frontend/src/components/` |
| Sync pipeline (SC Wiki, FleetYards, scunpacked, RSI) | Done — 5 staggered crons |
| Encryption + LLM integration | Done |
| Auth + CORS + security fixes | Done |
| Custom domain (`fleet.nerdz.cloud`) | Done |
| Cloudflare Zero Trust (Google OAuth) | Done — gavin + valkyrie |
| Secrets (API_TOKEN, ENCRYPTION_KEY) | Done |
| Workers Observability | Done — enabled in wrangler.toml |
| GitHub Actions CI/CD | Done — `.github/workflows/deploy.yml` |
| Old Go code removed | Done — `internal/`, `cmd/`, go.mod, Dockerfile, helm/ |
| workers.dev subdomain disabled | Done |
| PR #1 merged, PR #2 merged | Done |

## Production

- **URL:** `fleet.nerdz.cloud` (behind Zero Trust)
- **Worker:** `sc-companion` on NERDZ account
- **D1:** `sc-companion` (26 tables, Oceania region)
- **Branch:** `main` (was `cf-rewrite`, now merged)
- **CI/CD:** Push to main → GitHub Actions → `wrangler deploy`
- **Figma:** File `Et3jaEnHdN2751GV8LrME4` (8 pages captured)

## Key Decisions

- Auth: `Sec-Fetch-Site: same-origin` trusts browser SPA; `X-API-Key` for external
- Staggered cron: 5 schedules (3:00-3:45 UTC), each with own 30s CPU budget
- scunpacked via GitHub API (Workers have no filesystem)
- Analysis prompt embedded as const (no filesystem)
- CI uses `npx wrangler deploy` with env vars (not wrangler-action, which failed to pass token)

## Recent Changes

- Added structured JSON logging (`src/lib/logger.ts`) with `logEvent()` helper
- Request logging middleware in `src/index.ts` (method, path, status, duration, geo, IP)
- Structured events at all business action points: fleet_import, llm_analysis, llm_test, cron_trigger, sync_start/complete/error, sync_vehicles, sync_items, sync_ship_images, sync_paint_images, sync_paints, sync_rsi_ships, sync_rsi_paints
- All events flow through existing OTEL pipeline to Grafana Cloud + New Relic

## What's Next

- **Deploy & verify** structured logs in Grafana (LogQL `| json | event="request"`) and New Relic
- **Testing & polish** (weekend work) — find bugs, UX improvements
- **Side project:** Standalone scraper/sync microservice (working with another Claude agent) that Fleet Manager could consume
- **Wrangler upgrade:** Currently 3.114.17, v4.67.0 available (not urgent)

---
**Session compacted at:** 2026-02-21 15:07:50

