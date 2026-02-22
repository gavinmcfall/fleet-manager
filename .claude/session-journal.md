# Session Journal

This file maintains running context across compactions.

## Current Focus

**UX Overhaul + Accessibility audit complete — all changes implemented, build verified.**

## Recent Changes

- **UX Phase 1-4:** Color tokens, typography, animations, ShipImage, ConfirmDialog, component polish, page-by-page UX, app shell mobile responsive
- **A11y Critical:** btn-primary text→sc-darker (2.64:1→13.5:1), global :focus-visible ring, .sr-only, .skip-link, @media prefers-reduced-motion, App.jsx skip nav + aria-labels
- **A11y Contrast:** sc-danger→#ef4444, sc-border→#2a4a6b, stat-label/table-header opacity removed, gray-600→gray-500 (icons) or gray-400 (text) across 13 files, gray-500→gray-400 for small body text, sort icon gray-700→gray-500
- **A11y Semantic HTML:** scope="col" on all th elements, sr-only captions on data tables, aria-labelledby/describedby on ConfirmDialog
- **A11y Screen Reader:** Charts wrapped in role="img" with data summaries, LoadingState role="status" + aria-live, ShipImage fallback aria-label, Import drop zone role="button" + keyboard handler + aria-label, aria-sort on sortable FleetTable headers

## Production

- **URL:** `fleet.nerdz.cloud` (behind Zero Trust)
- **Worker:** `sc-companion` on NERDZ account
- **D1:** `sc-companion` (26 tables, Oceania region)
- **Branch:** `main`
- **CI/CD:** Push to main → GitHub Actions → `wrangler deploy`

## Key Decisions

- Auth: `Sec-Fetch-Site: same-origin` trusts browser SPA; `X-API-Key` for external
- Staggered cron: 5 schedules (3:00-3:45 UTC), each with own 30s CPU budget
- Color tokens: sc-warn amber (#f5a623), sc-success teal (#2ec4b6), sc-melt gold (#f0c674) — deuteranopia safe
- ShipImage component replaces all inline <img> tags — no more layout collapse on error
- ConfirmDialog replaces all window.confirm()/alert() calls

## What's Next

- **Commit** accessibility changes
- **Visual review** — run wrangler dev and check all pages
- **Deploy** to production via git push

---
**Session compacted at:** 2026-02-22 15:12:41

