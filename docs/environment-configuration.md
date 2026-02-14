# Environment Configuration Guide

## Overview

Fleet Manager is configured entirely through environment variables, making it easy to deploy across different environments (local development, Docker, Kubernetes).

## Quick Start

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your preferences:
   ```bash
   nano .env
   ```

3. Run the application:
   ```bash
   ./fleet-manager
   ```

## Variable Naming Consistency

All SC Wiki-related variables now use the consistent `SC_WIKI_` prefix:
- ✅ `SC_WIKI_ENABLED`
- ✅ `SC_WIKI_RATE_LIMIT` (fixed from `SC_API_RATE_LIMIT`)
- ✅ `SC_WIKI_BURST` (fixed from `SC_API_BURST`)

## Configuration Sections

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server listen port |
| `BASE_URL` | `http://localhost:8080` | Base URL for link generation |

### Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_DRIVER` | `sqlite` | Database driver: `sqlite` or `postgres` |
| `DB_PATH` | `./data/fleet-manager.db` | SQLite database file path |
| `DATABASE_URL` | - | PostgreSQL connection string |

**PostgreSQL Example:**
```bash
DATABASE_URL=postgres://user:password@localhost:5432/fleetmanager?sslmode=disable
```

### FleetYards API Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `FLEETYARDS_BASE_URL` | `https://api.fleetyards.net` | FleetYards API endpoint |
| `FLEETYARDS_USER` | - | Your FleetYards username (optional) |

### SC Wiki API Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SC_WIKI_ENABLED` | `true` | Enable SC Wiki API sync |
| `SC_WIKI_RATE_LIMIT` | `1.0` | Requests per second |
| `SC_WIKI_BURST` | `5` | Max concurrent requests |

**Important Notes:**
- First sync takes 5-10 minutes
- **NOT** triggered on startup (too heavy)
- Trigger manually via UI or `POST /api/sync/scwiki`
- Nightly cron job can poll for incremental updates (future feature)

### Sync Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SYNC_SCHEDULE` | `0 3 * * *` | Cron expression for auto-sync |
| `SYNC_ON_STARTUP` | `false` | Sync FleetYards ships on startup |

**Important:**
- `SYNC_ON_STARTUP` only affects FleetYards sync (~30 seconds)
- SC Wiki sync is NEVER auto-triggered on startup
- Use manual trigger for SC Wiki sync

**Cron Schedule Examples:**
```bash
# Daily at 3:00 AM
SYNC_SCHEDULE=0 3 * * *

# Every 6 hours
SYNC_SCHEDULE=0 */6 * * *

# Sundays at 2:00 AM
SYNC_SCHEDULE=0 2 * * 0

# Daily at 1:30 AM
SYNC_SCHEDULE=30 1 * * *
```

### Frontend Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `STATIC_DIR` | `./frontend/dist` | Path to built React assets |

## Recommended Configurations

### Local Development

```bash
# .env
PORT=8080
DB_DRIVER=sqlite
DB_PATH=./data/fleet-manager.db
FLEETYARDS_USER=YourUsername
SC_WIKI_ENABLED=true
SC_WIKI_RATE_LIMIT=1.0
SC_WIKI_BURST=5
SYNC_ON_STARTUP=false
```

**Why `SYNC_ON_STARTUP=false`?**
- Faster startup during development
- Trigger syncs manually when needed
- Prevents repeated syncs on every restart

### Docker Deployment

```bash
# .env or docker-compose.yml
PORT=8080
DB_DRIVER=sqlite
DB_PATH=/app/data/fleet-manager.db
FLEETYARDS_USER=YourUsername
SC_WIKI_ENABLED=true
SC_WIKI_RATE_LIMIT=1.0
SC_WIKI_BURST=5
SYNC_SCHEDULE=0 3 * * *
SYNC_ON_STARTUP=false
STATIC_DIR=/app/frontend/dist
```

### Kubernetes with PostgreSQL

```yaml
env:
  - name: PORT
    value: "8080"
  - name: DB_DRIVER
    value: "postgres"
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: fleet-manager-db-app
        key: uri
  - name: FLEETYARDS_USER
    value: "YourUsername"
  - name: SC_WIKI_ENABLED
    value: "true"
  - name: SC_WIKI_RATE_LIMIT
    value: "1.0"
  - name: SC_WIKI_BURST
    value: "5"
  - name: SYNC_SCHEDULE
    value: "0 3 * * *"
  - name: SYNC_ON_STARTUP
    value: "false"
  - name: STATIC_DIR
    value: "/app/frontend/dist"
```

## Sync Behavior

### FleetYards Ship Database Sync
- **Duration:** ~30 seconds
- **Data:** Ship reference database (~230+ ships)
- **Triggers:**
  - Manual: `POST /api/sync/ships`
  - Scheduled: Nightly at 3 AM (configurable via `SYNC_SCHEDULE`)
  - Startup: Optional via `SYNC_ON_STARTUP=true`

### SC Wiki API Sync
- **Duration:** 5-10 minutes (first run)
- **Data:** Manufacturers, vehicles with ports, ship components, FPS items
- **Triggers:**
  - Manual only: `POST /api/sync/scwiki` or UI button
  - Scheduled: Nightly at 3 AM (same cron, separate endpoint)
  - Startup: **NEVER** (too heavy)

### FleetYards Hangar Sync
- **Duration:** ~5-15 seconds
- **Data:** Your public hangar from FleetYards
- **Triggers:**
  - Manual only: `POST /api/sync/hangar`
  - Requires: `FLEETYARDS_USER` configured

## Security Considerations

### Environment Files
- `.env` is in `.gitignore` - safe for local secrets
- Never commit `.env` to version control
- Use `.env.example` as a template in the repo

### Database URLs
```bash
# Good: Use environment-specific credentials
DATABASE_URL=postgres://fleetmanager:${DB_PASSWORD}@postgres:5432/fleetmanager

# Bad: Hardcoded credentials
DATABASE_URL=postgres://admin:password123@postgres:5432/fleetmanager
```

### Kubernetes Secrets
```yaml
# Use Secrets for sensitive data
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: fleet-manager-db
      key: connection-string
```

## Troubleshooting

### Issue: SC Wiki sync fails with rate limit errors

**Solution:** Lower the rate limit
```bash
SC_WIKI_RATE_LIMIT=0.5  # Half the requests
SC_WIKI_BURST=3          # Lower burst
```

### Issue: Database connection errors with PostgreSQL

**Check:**
1. Connection string format: `postgres://user:pass@host:port/db?sslmode=disable`
2. Database exists: `createdb fleetmanager`
3. User permissions: `GRANT ALL PRIVILEGES ON DATABASE fleetmanager TO fleetuser;`

### Issue: App starts but shows empty ship database

**Solution:** Trigger initial sync
```bash
# Via API
curl -X POST http://localhost:8080/api/sync/ships

# Or set in .env
SYNC_ON_STARTUP=true
```

### Issue: Frontend not loading / 404 errors

**Check:**
1. Frontend is built: `cd frontend && npm run build`
2. `STATIC_DIR` points to correct path
3. Files exist: `ls -la ./frontend/dist/index.html`

## Migration from Old Variable Names

If you're upgrading from a version that used `SC_API_RATE_LIMIT` and `SC_API_BURST`:

### Find and Replace
```bash
# In your .env or deployment configs
SC_API_RATE_LIMIT  →  SC_WIKI_RATE_LIMIT
SC_API_BURST       →  SC_WIKI_BURST
```

### Kubernetes ConfigMaps/Secrets
```bash
# Update your HelmRelease or Deployment
kubectl edit deployment fleet-manager -n default
# Change the env var names in the spec
```

### Docker Compose
```yaml
# docker-compose.yml
environment:
  # Old (deprecated)
  - SC_API_RATE_LIMIT=1.0
  - SC_API_BURST=5

  # New (correct)
  - SC_WIKI_RATE_LIMIT=1.0
  - SC_WIKI_BURST=5
```

## Advanced Configuration

### Custom Cron Schedules

```bash
# Sync every 4 hours at :15 past the hour
SYNC_SCHEDULE=15 */4 * * *

# Sync twice daily (6 AM and 6 PM)
SYNC_SCHEDULE=0 6,18 * * *

# Sync Monday-Friday at 2 AM
SYNC_SCHEDULE=0 2 * * 1-5

# First day of every month at midnight
SYNC_SCHEDULE=0 0 1 * *
```

### Multiple Environments

Use different `.env` files:

```bash
# Development
cp .env.example .env.dev
# Edit for local development

# Production
cp .env.example .env.prod
# Edit for production

# Run with specific env
./fleet-manager  # Uses .env by default
```

Or use environment-specific variables:
```bash
export FLEET_ENV=production
export DB_DRIVER=postgres
export DATABASE_URL=...
./fleet-manager
```

## References

- Main README: [README.md](../README.md)
- SC Wiki Sync Implementation: [sc-wiki-sync-implementation.md](./sc-wiki-sync-implementation.md)
- Example Configuration: [.env.example](../.env.example)
