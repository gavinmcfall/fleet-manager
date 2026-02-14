# Star Citizen Wiki API Sync - Implementation Plan

## Data Endpoints to Sync

1. **game_versions** - `/api/game-versions` (LIVE, PTU, EPTU tracking)
2. **sc_vehicles** - `/api/vehicles` (in-game ship data with stats)
3. **sc_items** - `/api/items` (components, weapons, etc.)
4. **manufacturers** - `/api/manufacturers` 
5. **shipmatrix_vehicles** - `/api/shipmatrix/vehicles` (ship matrix data)
6. **comm_links** - `/api/comm-links` (official news)
7. **galactapedia** - `/api/galactapedia` (lore)
8. **celestial_objects** - `/api/celestial-objects`
9. **starsystems** - `/api/starsystems`

## Database Tables

### sync_metadata
Track sync state for each endpoint:
```sql
CREATE TABLE sc_sync_metadata (
  endpoint VARCHAR(100) PRIMARY KEY,
  last_sync_at TIMESTAMP,
  last_updated_record TIMESTAMP,
  total_records INTEGER,
  sync_status VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### sc_game_versions
```sql
CREATE TABLE sc_game_versions (
  id INTEGER PRIMARY KEY,
  uuid TEXT UNIQUE,
  code VARCHAR(50) UNIQUE NOT NULL,
  channel VARCHAR(20),
  is_default BOOLEAN DEFAULT false,
  released_at TIMESTAMP,
  data JSONB, -- Full API response
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### sc_manufacturers
```sql
CREATE TABLE sc_manufacturers (
  id INTEGER PRIMARY KEY,
  uuid TEXT UNIQUE,
  name VARCHAR(255),
  slug VARCHAR(255) UNIQUE,
  known_for TEXT,
  description TEXT,
  logo_url TEXT,
  data JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### sc_vehicles
Main in-game vehicle data:
```sql
CREATE TABLE sc_vehicles (
  id INTEGER PRIMARY KEY,
  uuid TEXT UNIQUE NOT NULL,
  class_name VARCHAR(255),
  name VARCHAR(255),
  slug VARCHAR(255),
  manufacturer_id INTEGER REFERENCES sc_manufacturers(id),
  
  -- Key stats
  size INTEGER,
  size_class INTEGER,
  career VARCHAR(100),
  role VARCHAR(100),
  is_vehicle BOOLEAN,
  is_gravlev BOOLEAN,
  is_spaceship BOOLEAN,
  
  -- Performance
  mass_total REAL,
  cargo_capacity REAL,
  vehicle_inventory REAL,
  crew_min INTEGER,
  crew_max INTEGER,
  
  -- Speed (if available)
  speed_max REAL,
  
  -- Version tracking
  game_version_id INTEGER REFERENCES sc_game_versions(id),
  
  -- Full data blob
  data JSONB,
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  INDEX idx_sc_vehicles_name (name),
  INDEX idx_sc_vehicles_slug (slug),
  INDEX idx_sc_vehicles_manufacturer (manufacturer_id),
  INDEX idx_sc_vehicles_version (game_version_id)
);
```

### sc_items
Components, weapons, etc:
```sql
CREATE TABLE sc_items (
  id INTEGER PRIMARY KEY,
  uuid TEXT UNIQUE NOT NULL,
  class_name VARCHAR(255),
  name VARCHAR(255),
  slug VARCHAR(255),
  manufacturer_id INTEGER REFERENCES sc_manufacturers(id),
  
  -- Classification
  type VARCHAR(100),
  sub_type VARCHAR(100),
  size INTEGER,
  grade VARCHAR(10),
  
  -- Stats stored in JSONB
  data JSONB,
  
  game_version_id INTEGER REFERENCES sc_game_versions(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  INDEX idx_sc_items_name (name),
  INDEX idx_sc_items_type (type),
  INDEX idx_sc_items_manufacturer (manufacturer_id)
);
```

### sc_shipmatrix_vehicles
Ship matrix data (complements sc_vehicles):
```sql
CREATE TABLE sc_shipmatrix_vehicles (
  id INTEGER PRIMARY KEY,
  uuid TEXT UNIQUE,
  name VARCHAR(255),
  slug VARCHAR(255),
  
  -- Pricing
  pledge_price REAL,
  price_auec REAL,
  
  -- Links to in-game vehicle
  sc_vehicle_uuid TEXT,
  
  data JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Other tables (simplified, store mostly as JSONB)
```sql
CREATE TABLE sc_comm_links (
  id INTEGER PRIMARY KEY,
  uuid TEXT UNIQUE,
  title TEXT,
  slug VARCHAR(255),
  published_at TIMESTAMP,
  data JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE sc_galactapedia (
  id INTEGER PRIMARY KEY,
  uuid TEXT UNIQUE,
  title TEXT,
  slug VARCHAR(255),
  data JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE sc_celestial_objects (
  id INTEGER PRIMARY KEY,
  uuid TEXT UNIQUE,
  name VARCHAR(255),
  type VARCHAR(100),
  data JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE sc_starsystems (
  id INTEGER PRIMARY KEY,
  uuid TEXT UNIQUE,
  name VARCHAR(255),
  data JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Rate Limiting Strategy

1. **Conservative Defaults**:
   - 1 request per second (60 req/min)
   - Exponential backoff on 429 responses
   - Respect `Retry-After` header

2. **Implementation**:
   - Use `golang.org/x/time/rate` limiter
   - Token bucket algorithm
   - Per-endpoint tracking

3. **Configurable via env vars**:
   - `SC_API_RATE_LIMIT` (default: 1)
   - `SC_API_BURST` (default: 5)

## Sync Strategy

### Phase 1: Full Initial Sync
1. Sync game_versions first (needed for foreign keys)
2. Sync manufacturers (needed for vehicle/item foreign keys)
3. Sync all endpoints in parallel (with rate limiting)
4. Store full JSONB data

### Phase 2: Incremental Updates (Nightly)
1. Query API with `sort=-updated_at`
2. Compare `updated_at` with `last_updated_record` from sync_metadata
3. Only fetch records newer than last sync
4. UPSERT into database

### Phase 3: Pagination Handling
```go
for page := 1; ; page++ {
    response := fetchPage(page)
    if len(response.Data) == 0 {
        break
    }
    upsertRecords(response.Data)
    if response.Meta.CurrentPage >= response.Meta.LastPage {
        break
    }
}
```

## File Structure

```
internal/
  scwiki/
    client.go         - HTTP client with rate limiting
    sync.go           - Sync orchestrator
    models.go         - Data models
    game_versions.go  - Game version sync
    vehicles.go       - Vehicle sync
    items.go          - Items sync
    manufacturers.go  - Manufacturer sync
    shipmatrix.go     - Ship matrix sync
    comm_links.go     - Comm links sync
    galactapedia.go   - Galactapedia sync
    celestial.go      - Celestial objects sync
    starsystems.go    - Star systems sync
```

## Implementation Phases

### Step 1: Foundation ✓
- [x] Database migrations
- [x] Models
- [x] Rate-limited HTTP client

### Step 2: Core Syncs
- [ ] Game versions sync
- [ ] Manufacturers sync
- [ ] Vehicles sync
- [ ] Items sync

### Step 3: Extended Data
- [ ] Ship matrix sync
- [ ] Comm links sync
- [ ] Galactapedia sync
- [ ] Celestial objects sync
- [ ] Star systems sync

### Step 4: Scheduler Integration
- [ ] Add to cron scheduler
- [ ] Nightly sync job (3 AM)
- [ ] Manual trigger endpoint
- [ ] Sync status dashboard

## API Client Features

```go
type SCWikiClient struct {
    httpClient  *http.Client
    rateLimiter *rate.Limiter
    baseURL     string
    userAgent   string
}

// Auto-retry with exponential backoff
// Parse pagination metadata
// Handle rate limits (429 responses)
// Track request metrics
```

## Monitoring

Log metrics:
- Records synced per endpoint
- API requests made
- Rate limit hits
- Errors encountered
- Sync duration

## Future Enhancements

1. **Differential sync** - Only sync changed records
2. **Webhook support** - Real-time updates if API adds webhooks
3. **Version comparison** - Track stat changes across game versions
4. **Archive old versions** - Keep historical data
5. **API health monitoring** - Track API availability
