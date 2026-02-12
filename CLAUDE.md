# Fleet Manager — Project Context

## What This Is
A Star Citizen fleet management app that tracks ships, insurance, pledge data, and fleet composition. Built as a self-hosted web app designed to run in a Kubernetes cluster via BJW-S app-template.

## Tech Stack
- **Backend:** Go 1.22, Chi router, SQLite (default) or PostgreSQL
- **Frontend:** React SPA (Vite), Tailwind CSS, Lucide icons
- **Deployment:** BJW-S app-template v3.x Helm chart, Flux GitOps

## Architecture

### Backend (`/internal/`)
- `api/router.go` — All HTTP handlers and routes. Import logic, enrichment, settings, debug endpoints.
- `database/database.go` — SQLite/PostgreSQL data layer. Vehicles, ships, hangar_imports, settings tables.
- `database/migrations.go` — Schema definitions. Tables: ships, vehicles, hangar_imports, sync_status, settings.
- `sync/scheduler.go` — Cron-based ship DB sync from FleetYards API. Manual hangar sync.
- `fleetyards/client.go` — FleetYards API client. Ship database + public hangar endpoints.
- `analysis/analysis.go` — Fleet analysis: gap detection, redundancies, insurance summary.
- `models/models.go` — All data models and JSON serialization.
- `config/config.go` — Environment variable configuration.

### Frontend (`/frontend/src/`)
- `pages/Dashboard.jsx` — Overview stats, quick actions
- `pages/FleetTable.jsx` — Sortable/filterable ship table with insurance column
- `pages/Insurance.jsx` — Insurance tracking view
- `pages/Analysis.jsx` — Gap analysis, redundancies, role distribution
- `pages/ShipDB.jsx` — Full FleetYards ship database browser
- `pages/Import.jsx` — Two-panel import: FleetYards sync OR HangarXplor JSON import
- `hooks/useAPI.js` — API client hooks and action functions

## Data Flow

### Two Import Sources (single-source design — only one active at a time)
1. **HangarXplor JSON** — Browser extension export. Has insurance/pledge data (LTI, warbond, pledge cost/date). Primary recommended source.
2. **FleetYards Public Hangar** — API sync. Has loaners, paints, canonical slugs. No insurance data.

### Enrichment
After HangarXplor import, user can "Enrich from FleetYards" which layers on loaner flags, paint names, and better slug matching WITHOUT replacing insurance data.

### Ship Matching (slug generation)
HangarXplor ship_codes like `MISC_Hull_D` get converted to slugs for matching against the FleetYards ship reference DB:
- `slugFromShipCode()` — strips manufacturer prefix, joins with hyphens: `hull-d`
- `slugFromName()` — strips punctuation including dots: `A.T.L.S.` → `atls`
- `compactSlug()` — strips ALL non-alphanumeric: `a-t-l-s` → `atls`
- `FindShipSlug()` — tries exact, name, then prefix match against ships table

### Settings
FleetYards username is stored in `settings` table (key-value). UI input on Import page. Falls back to `FLEETYARDS_USER` env var.

## Key Design Decisions
- **Single source**: Importing from either source does a clean slate (DELETE all vehicles + hangar_imports, then INSERT). No merging.
- **No UNIQUE constraint on vehicles**: Users can own multiples of the same ship (e.g., two PTVs).
- **InsertVehicle returns ID**: Used to link vehicles → hangar_imports via `vehicle_id` foreign key.
- **SQL JOIN for insurance**: `GetVehiclesWithInsurance()` does `LEFT JOIN hangar_imports hi ON hi.vehicle_id = v.id` — not Go-side matching.
- **Gap analysis uses contains matching**: Focus strings like "Prospecting / Mining" match gap terms like "mining" via `strings.Contains`.

## Build & Run
```bash
rm -f data/fleet-manager.db  # Clean DB if schema changed
cd frontend && npm install && npm run build && cd ..
go mod tidy && CGO_ENABLED=1 go build -o fleet-manager ./cmd/server
./fleet-manager
```

## Environment Variables
- `PORT` (default: 8080)
- `DB_DRIVER` (default: sqlite)
- `DB_PATH` (default: ./data/fleet-manager.db)
- `DATABASE_URL` (for postgres)
- `FLEETYARDS_USER` (optional, can be set in UI instead)
- `SYNC_SCHEDULE` (default: "0 3 * * *")
- `STATIC_DIR` (default: ./frontend/dist)

## Debug Endpoint
`GET /api/debug/imports` — Shows vehicle_id linkage, hangar_import counts, JOIN verification.

## Owner Context
- Gavin, Senior QA at Pushpay (not a developer — explain things clearly)
- Runs a homelab Kubernetes cluster (TalosOS, Flux GitOps, BJW-S app-template)
- GitHub: gavinmcfall/fleet-manager
- FleetYards username: NZVengeance
- Has 38 ships including custom-named ones (Jean-Luc = Carrack, James Holden = Idris-P)
