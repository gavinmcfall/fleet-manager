# Fleet Manager — Project Context

## What This Is
A Star Citizen fleet management app that tracks ships, insurance, pledge data, and fleet composition. Built as a self-hosted web app designed to run in a Kubernetes cluster via BJW-S app-template.

## Tech Stack
- **Backend:** Go 1.22, Chi router, SQLite (default) or PostgreSQL
- **Frontend:** React SPA (Vite), Tailwind CSS, Lucide icons
- **Deployment:** BJW-S app-template v3.x Helm chart, Flux GitOps

## Architecture

### Backend (`/internal/`)
- `api/router.go` — All HTTP handlers and routes. Import logic, settings, debug endpoints.
- `database/database.go` — SQLite/PostgreSQL data layer. Vehicles, user_fleet, manufacturers, sync_history tables.
- `database/migrations.go` — Schema definitions. 25 tables including lookup tables and `paint_vehicles` junction.
- `sync/scheduler.go` — Cron-based sync: SC Wiki (primary data), FleetYards (images only).
- `fleetyards/client.go` — FleetYards API client. Image-only — fetches store images for ships and paints by slug.
- `scunpacked/reader.go` — Parses paint_*.json files from scunpacked-data repo.
- `scunpacked/sync.go` — Matches paints to vehicles by tag (many-to-many via `paint_vehicles`), tag alias map for unresolvable abbreviations.
- `rsi/import.go` — One-time RSI extract image importer. Reads ship matrix + paint catalog JSON extracts, matches to DB vehicles/paints by name, updates image URLs with RSI CDN links.
- `scwiki/client.go` — SC Wiki API client with rate limiting.
- `scwiki/sync.go` — SC Wiki sync logic: manufacturers, vehicles (specs, dimensions, pricing, status), loaners.
- `scwiki/models.go` — SC Wiki API response types.
- `analysis/analysis.go` — Fleet analysis: gap detection, redundancies, insurance summary.
- `models/models.go` — All data models and JSON serialization.
- `config/config.go` — Environment variable configuration.

### Frontend (`/frontend/src/`)
- `pages/Dashboard.jsx` — Overview stats, quick actions
- `pages/FleetTable.jsx` — Sortable/filterable ship table with insurance column
- `pages/Insurance.jsx` — Insurance tracking view
- `pages/Analysis.jsx` — Gap analysis, redundancies, role distribution
- `pages/ShipDB.jsx` — Full ship database browser (data from SC Wiki)
- `pages/Import.jsx` — HangarXplor JSON import
- `hooks/useAPI.js` — API client hooks and action functions

## Data Flow

### Data Sources
1. **SC Wiki API** (primary) — All ship data: specs, dimensions, pricing, production status, descriptions, manufacturers, loaners. Synced nightly and on startup.
2. **FleetYards API** (images only) — Store images for ships and paints. Synced after SC Wiki so vehicles exist first.
3. **scunpacked-data** (paint metadata) — Local JSON files from `scunpacked-data` repo. Paint names, descriptions, ship compatibility tags. Synced after images.
4. **RSI extract images** (one-time seed) — JSON extracts from RSI pledge store/ship matrix. Provides RSI CDN ship images (media.robertsspaceindustries.com) with multiple size variants. Runs after FleetYards sync, overwrites with higher-quality RSI CDN URLs. Also supplements paint images for paints without FleetYards coverage.
5. **HangarXplor JSON** (user fleet) — Browser extension export. Insurance/pledge data (LTI, warbond, pledge cost/date). Only source for user fleet data.

### Ship Matching (slug generation)
HangarXplor ship_codes like `MISC_Hull_D` get converted to slugs for matching against the vehicle reference DB:
- `slugFromShipCode()` — strips manufacturer prefix, joins with hyphens: `hull-d`
- `slugFromName()` — strips punctuation including dots: `A.T.L.S.` → `atls`
- `compactSlug()` — strips ALL non-alphanumeric: `a-t-l-s` → `atls`
- `FindVehicleSlug()` — tries exact, name, then prefix match against vehicles table

## Key Design Decisions
- **Clean slate import**: HangarXplor import does DELETE all user_fleet + INSERT. No merging.
- **No UNIQUE constraint on user_fleet**: Users can own multiples of the same ship (e.g., two PTVs).
- **SC Wiki is primary data source**: All ship specs, dimensions, pricing, status, descriptions come from SC Wiki API.
- **FleetYards is images only**: Retained solely for store images (ships + paints). All non-image FleetYards code removed.
- **Paint sync pipeline**: scunpacked-data provides metadata (names, descriptions, ship tags), FleetYards provides paint images. UPSERT uses COALESCE so neither source overwrites the other.
- **Paints are many-to-many**: `paint_vehicles` junction table links paints to ALL compatible vehicles (e.g., Aurora paints → 5 variants). Tag alias map resolves abbreviations (890j→890-jump, star-runner→mercury-star-runner).
- **Insurance is typed**: `insurance_types` lookup table with duration_months (LTI, 120-month, 6-month, etc.)
- **user_fleet join table**: Links users to vehicle reference data. Insurance, pledge data, custom names live here.
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
- `FLEETYARDS_BASE_URL` (default: https://api.fleetyards.net — images only)
- `SC_WIKI_ENABLED` (default: true)
- `SC_WIKI_RATE_LIMIT` (default: 1.0 req/s)
- `SC_WIKI_BURST` (default: 5)
- `SCUNPACKED_DATA_PATH` (default: "" — disabled when empty, set to path of scunpacked-data repo)
- `SYNC_SCHEDULE` (default: "0 3 * * *")
- `SYNC_ON_STARTUP` (default: true)
- `RSI_EXTRACT_PATH` (default: "" — disabled when empty, set to directory containing ships.json and paints.json RSI extracts)
- `STATIC_DIR` (default: ./frontend/dist)

## Debug Endpoint
`GET /api/debug/imports` — Shows vehicle_id linkage, fleet counts, sample entries.

## Owner Context
- Gavin, Senior QA at Pushpay (not a developer — explain things clearly)
- Runs a homelab Kubernetes cluster (TalosOS, Flux GitOps, BJW-S app-template)
- GitHub: gavinmcfall/fleet-manager
- Has 38 ships including custom-named ones (Jean-Luc = Carrack, James Holden = Idris-P)
