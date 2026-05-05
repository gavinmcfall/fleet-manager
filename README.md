# SC Bridge

A Star Citizen companion web app — fleet management, hangar sync, ship database, insurance tracking, loot data, and game reference. Live at [scbridge.app](https://scbridge.app).

## Downloads

### Browser Extension — SC Bridge Sync

[![Chrome](https://img.shields.io/badge/Chrome-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://github.com/SC-Bridge/sc-bridge-sync/releases/latest/download/sc-bridge-sync-chrome.zip)
[![Firefox](https://img.shields.io/badge/Firefox-FF7139?style=for-the-badge&logo=firefox&logoColor=white)](https://github.com/SC-Bridge/sc-bridge-sync/releases/latest/download/sc-bridge-sync-firefox.zip)
[![Edge](https://img.shields.io/badge/Edge-0078D7?style=for-the-badge&logo=microsoftedge&logoColor=white)](https://github.com/SC-Bridge/sc-bridge-sync/releases/latest/download/sc-bridge-sync-edge.zip)
[![Opera](https://img.shields.io/badge/Opera-FF1B2D?style=for-the-badge&logo=opera&logoColor=white)](https://github.com/SC-Bridge/sc-bridge-sync/releases/latest/download/sc-bridge-sync-opera.zip)

### SC Bridge HUD — In-Game Overlay

[![Download Portable EXE](https://img.shields.io/badge/Download-Portable%20EXE-2ea44f?style=for-the-badge&logo=windows)](https://github.com/SC-Bridge/SC-HUD/releases/latest/download/SCBridgeHUD-portable.exe)
[![Download MSI Installer](https://img.shields.io/badge/Download-MSI%20Installer-0078d4?style=for-the-badge&logo=windows)](https://github.com/SC-Bridge/SC-HUD/releases/latest/download/SCBridgeHUD-setup.msi)

### SC Bridge Companion — Desktop App

[![Download Portable EXE](https://img.shields.io/badge/Download-Portable%20EXE-2ea44f?style=for-the-badge&logo=windows)](https://github.com/SC-Bridge/sc-companion/releases/latest/download/SCBridgeCompanion-portable.exe)
[![Download MSI Installer](https://img.shields.io/badge/Download-MSI%20Installer-0078d4?style=for-the-badge&logo=windows)](https://github.com/SC-Bridge/sc-companion/releases/latest/download/SCBridgeCompanion-setup.msi)

![Dashboard](screenshots/dashboard.png)

## Features

### Fleet Management
Track your ships, custom names, insurance types, pledge costs, and production status. Synced directly from your RSI hangar.

![Fleet](screenshots/fleet.png)

### Hangar Sync
Sync your RSI hangar to SC Bridge with the [SC Bridge Sync](https://github.com/SC-Bridge/sc-bridge-sync) browser extension. Ships, insurance, buy-back pledges, upgrade history, and account info — collected automatically from the RSI website.

![Sync & Import](screenshots/sync-import.png)

### Ship Database
Browse all Star Citizen ships with specs, components, weapons, paints, loadouts, and performance data.

![Ship Detail](screenshots/ship-detail-idris.png)

### Insurance Tracker
Dashboard showing LTI vs timed insurance coverage, pledge history, and at-risk ships.

![Insurance](screenshots/insurance.png)

### Loot Database
Browse in-game loot with location data, rarity, and NPC drop sources.

![Loot Database](screenshots/loot-db.png)

### NPC Loadouts
What gear NPCs wear and carry, organized by faction.

![NPC Loadouts](screenshots/npc-loadouts.png)

### More
- **Fleet Analysis** — AI-powered gap detection, redundancy analysis, role distribution
- **Org Support** — org fleets with visibility controls (public / org / officers / private)
- **Game Reference** — shops, trade commodities, factions, laws, reputation, careers, missions

## Tech Stack

- **Backend**: Cloudflare Worker (TypeScript), [Hono](https://hono.dev) framework
- **Database**: Cloudflare D1 (SQLite), 121 migrations
- **Auth**: [Better Auth](https://www.better-auth.com) with email, Google, Discord, GitHub, Twitch
- **Frontend**: React SPA, [Vite](https://vitejs.dev), Tailwind CSS, Recharts
- **Extension**: WXT browser extension (Chrome + Firefox) for RSI hangar sync
- **Caching**: Cloudflare Workers KV (25 game-data endpoints)
- **Storage**: Cloudflare R2 (avatars), Workers Assets (SPA)
- **CI/CD**: GitHub Actions → `wrangler deploy` on push to `main` or `staging`

## Data Sources

| Source | What | When |
|--------|------|------|
| RSI hangar (via extension) | Fleet, insurance, pledges, buy-back, upgrades, account | User-triggered sync |
| HangarXplor JSON | Fleet import (legacy fallback) | User-triggered upload |
| RSI GraphQL API | Ship + paint images | Nightly cron (3:45 AM) |
| Fleetyards API | Production status sync | Nightly cron (4:00 AM) |
| DataCore p4k extraction | Components, FPS gear, loot map, NPC loadouts | Manual extraction scripts |

## Development

### Prerequisites

- Node.js 22+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account (for D1, R2, KV)

### Local Dev

```bash
npm install
npm run dev          # Vite dev server + Worker via miniflare
```

### Build & Deploy

```bash
npm run build        # Build frontend + bundle Worker
npm run deploy       # wrangler deploy (requires CLOUDFLARE_API_TOKEN)
```

Push to `main` deploys to production. Push to `staging` deploys to staging.

### Database Migrations

```bash
source ~/.secrets
# Staging
npx wrangler d1 migrations apply scbridge-staging --remote --env staging --config wrangler.toml
# Production
npx wrangler d1 migrations apply scbridge-production --remote --env production --config wrangler.toml
```

Migrations in `src/db/migrations/`. Conventions in `src/db/CONVENTIONS.md`.

## Environments

| | Production | Staging |
|-|-----------|---------|
| **URL** | scbridge.app | staging.scbridge.app |
| **Worker** | scbridge | scbridge-staging |
| **D1** | scbridge-production | scbridge-staging |
| **Deploy** | push to `main` | push to `staging` |

## License

MIT
