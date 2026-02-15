# Session Journal

This file maintains running context across compactions.

## Current Focus

**Database Schema Redesign** - Major refactor planned and approved in plan file `zazzy-bubbling-hammock.md`. Ready to implement.

## Recent Changes

- Fixed Insurance.jsx: Added missing `useState`/`useMemo` imports, moved hooks above early returns to fix React error #310 (infinite re-render)
- Frontend rebuilt after Insurance fix
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

### Previous Decisions
- FleetYards only works with public hangars (warnings added to Import page)
- LLM integration complete: AES-256-GCM encrypted keys, Claude/ChatGPT/Gemini, Settings page, AI insights on Analysis page
- SC Wiki API sync complete: manufacturers, vehicles, items, ports, game versions

## Important Context

- **Plan file:** `/home/gavin/.claude/plans/zazzy-bubbling-hammock.md` — full schema DDL, migration strategy, implementation phases 1-8
- **All SC Wiki sync phases were completed** before this redesign (but will need refactoring to target new tables)
- **All LLM integration was completed** (but settings/keys will move to user_llm_configs)
- **Owner:** Gavin, Senior QA at Pushpay, not a developer. FleetYards username: NZVengeance. 38 ships.
- **Tech:** Go 1.22, Chi router, SQLite/PostgreSQL, React SPA (Vite), Tailwind CSS


---
**Session compacted at:** 2026-02-13 16:29:26


---
**Session compacted at:** 2026-02-13 18:45:50


---
**Session compacted at:** 2026-02-14 07:07:32


---
**Session compacted at:** 2026-02-14 08:18:19


---
**Session compacted at:** 2026-02-15 15:17:00

