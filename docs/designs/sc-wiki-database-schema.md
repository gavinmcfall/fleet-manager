---
description: Database schema design for Star Citizen Wiki API data replication
tags: [database, schema, sc-wiki-api, design, normalization]
audience: { human: 55, agent: 45 }
purpose: { design: 75, gestalt: 25 }
---

# SC Wiki API Database Schema Design

## Context

Fleet Manager currently uses FleetYards API for ship data (~800 ships, 38 user vehicles). To expand coverage, we're replicating the "vast majority of the SC Wiki API" into a local database with nightly sync:

- **22,504 entities** across 7 major categories (vehicles, items, manufacturers, celestial objects, galactapedia, shops, commodities)
- **90 MB current**, ~185 MB projected (5 years)
- **Read-heavy workload** (web UI + LLM queries)
- **Nightly sync** from api.star-citizen.wiki
- **Dual driver support** (SQLite default, PostgreSQL optional)

Research findings in `/docs/research/sc-wiki-api.md` and `/docs/research/database-strategy.md`.

**Flows enabled**:
- Ship browser with full component details
- Item search and filtering
- Celestial object/star map visualization
- Galactapedia content integration
- LLM context enrichment for fleet analysis

**Cross-cutting concerns**:
- Game version tracking (data changes with patches)
- Sync failure recovery (partial sync shouldn't corrupt DB)
- Large nested payloads (680 KB hardpoints on large ships)
- Dual-driver SQL dialect abstraction

## Constraints

### Technical
- **Existing dual-driver abstraction**: `placeholder()`, `autoIncrement()`, `onConflictUpdate()` helpers already in place
- **SQLite limitations**: No JSONB indexes, TOAST threshold N/A, simpler type system
- **PostgreSQL advantages**: JSONB GIN indexes, better concurrency, but requires container deployment
- **Go stdlib database/sql**: Manual SQL, no ORM

### Performance
- **Read-heavy**: 95%+ reads (web UI queries, LLM context fetches)
- **Write pattern**: Bulk nightly sync (DELETE + INSERT batches)
- **Query patterns**:
  - Ship detail with components (JOIN vehicles → hardpoints → items)
  - Item search/filter across 19K items
  - Celestial object hierarchy traversal (recursive parent/child)
  - Galactapedia full-text search

### Data Characteristics
- **Payload sizes**: 2 KB (items) to 680 KB (Polaris hardpoints)
- **Nesting depth**: Up to 13 levels (recursive hardpoints)
- **Growth rate**: 10-30% annual (major patches add 2K+ items)
- **Version churn**: Data changes with every game patch (monthly)

## Design

### North Star

**Enable fast queries for web UI and LLM access while keeping sync implementation simple and schema evolution straightforward.**

Not the most normalized design. Not the most denormalized. The structure that serves reads well without making writes brittle.

### Core Schema

#### 1. Manufacturers

```sql
CREATE TABLE manufacturers (
    uuid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    code TEXT,
    description TEXT,
    known_for TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_manufacturers_slug ON manufacturers(slug);
```

**Rationale**: Small table (124 rows), referenced by many entities. Normalize to avoid duplication.

**Sync strategy**: Full replace (DELETE ALL + INSERT 124 rows = trivial)

#### 2. Vehicles

```sql
CREATE TABLE vehicles (
    uuid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    manufacturer_uuid TEXT REFERENCES manufacturers(uuid) ON DELETE SET NULL,
    size TEXT,
    focus TEXT,
    type TEXT,
    description TEXT,
    production_status TEXT,
    pledge_price DECIMAL(10,2),
    on_sale BOOLEAN DEFAULT false,
    game_version TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vehicles_slug ON vehicles(slug);
CREATE INDEX idx_vehicles_manufacturer ON vehicles(manufacturer_uuid);
CREATE INDEX idx_vehicles_size ON vehicles(size);
CREATE INDEX idx_vehicles_focus ON vehicles(focus);
CREATE INDEX idx_vehicles_production_status ON vehicles(production_status);
```

**Rationale**: Core entity. Most fields denormalized into columns for fast filtering. Hardpoints extracted to separate table (see below).

**No UNIQUE on slug + game_version**: Current implementation tracks only latest version. Historical tracking deferred to future if needed.

**Sync strategy**: Incremental possible via If-Modified-Since, but full replace simpler (288 rows = trivial)

#### 3. Hardpoints (Junction + Metadata)

```sql
CREATE TABLE hardpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- SQLite / SERIAL for PostgreSQL
    uuid TEXT NOT NULL UNIQUE,
    vehicle_uuid TEXT NOT NULL REFERENCES vehicles(uuid) ON DELETE CASCADE,
    parent_hardpoint_id INTEGER REFERENCES hardpoints(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    sub_category TEXT,
    type TEXT,
    equipped_item_uuid TEXT REFERENCES items(uuid) ON DELETE SET NULL,
    min_size INTEGER,
    max_size INTEGER,
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hardpoints_vehicle ON hardpoints(vehicle_uuid);
CREATE INDEX idx_hardpoints_parent ON hardpoints(parent_hardpoint_id);
CREATE INDEX idx_hardpoints_item ON hardpoints(equipped_item_uuid);
CREATE INDEX idx_hardpoints_category ON hardpoints(category);
```

**Rationale**:
- **Normalize hardpoints** to avoid 680 KB payloads in vehicles table
- **Self-referencing FK** (`parent_hardpoint_id`) for recursive nesting (turrets)
- **Junction table role**: Links vehicles ↔ items with metadata (slot name, size constraints)
- **Cascading deletes**: If vehicle deleted, all its hardpoints cascade

**Complexity contained**: Recursive nesting is inherent (game design). Containment strategy: represent as adjacency list, queries use recursive CTEs.

**Sync strategy**: Per-vehicle DELETE + INSERT of all hardpoints (avoids diff logic)

#### 4. Items

```sql
CREATE TABLE items (
    uuid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    manufacturer_uuid TEXT REFERENCES manufacturers(uuid) ON DELETE SET NULL,
    type TEXT NOT NULL,
    sub_type TEXT,
    size INTEGER,
    grade TEXT,
    description TEXT,
    base_price DECIMAL(10,2),
    game_version TEXT,
    metadata JSONB, -- PostgreSQL / TEXT for SQLite
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_items_slug ON items(slug);
CREATE INDEX idx_items_manufacturer ON items(manufacturer_uuid);
CREATE INDEX idx_items_type ON items(type);
CREATE INDEX idx_items_sub_type ON items(sub_type);
CREATE INDEX idx_items_size ON items(size);

-- PostgreSQL only (conditional in migration)
CREATE INDEX idx_items_metadata_gin ON items USING GIN (metadata); -- if driver == postgres
```

**Rationale**:
- **Type fields normalized**: Common query filters (type, sub_type, size)
- **Metadata JSONB/TEXT**: Type-specific fields (weapons have DPS, shields have HP, coolers have cooling rate). Average 2-9 KB, not worth extracting.
- **No slug uniqueness**: Same item can exist in multiple game versions

**Sync strategy**: Incremental via If-Modified-Since (19K items = worth optimizing)

**PostgreSQL advantage**: GIN index on metadata enables fast JSONB queries. SQLite falls back to full table scan for metadata queries.

#### 5. Vehicle Loaners (Junction)

```sql
CREATE TABLE vehicle_loaners (
    vehicle_uuid TEXT NOT NULL REFERENCES vehicles(uuid) ON DELETE CASCADE,
    loaner_uuid TEXT NOT NULL REFERENCES vehicles(uuid) ON DELETE CASCADE,
    PRIMARY KEY (vehicle_uuid, loaner_uuid)
);

CREATE INDEX idx_vehicle_loaners_vehicle ON vehicle_loaners(vehicle_uuid);
CREATE INDEX idx_vehicle_loaners_loaner ON vehicle_loaners(loaner_uuid);
```

**Rationale**: Self-referencing many-to-many. Carrack includes Pisces loaner, Pisces is a standalone vehicle.

**Sync strategy**: Per-vehicle DELETE + INSERT

#### 6. Celestial Objects

```sql
CREATE TABLE celestial_objects (
    uuid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    designation TEXT,
    star_system_uuid TEXT REFERENCES celestial_objects(uuid) ON DELETE CASCADE,
    parent_uuid TEXT REFERENCES celestial_objects(uuid) ON DELETE CASCADE,
    habitable BOOLEAN,
    description TEXT,
    game_version TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_celestial_objects_slug ON celestial_objects(slug);
CREATE INDEX idx_celestial_objects_type ON celestial_objects(type);
CREATE INDEX idx_celestial_objects_star_system ON celestial_objects(star_system_uuid);
CREATE INDEX idx_celestial_objects_parent ON celestial_objects(parent_uuid);
```

**Rationale**:
- **Polymorphic table**: Star systems, planets, moons, stations all in one table (differentiated by `type`)
- **Two FKs**: `star_system_uuid` (shortcut to root) + `parent_uuid` (immediate parent). Enables both "all objects in Stanton" and "moons of Crusader" queries without recursive CTE.

**Sync strategy**: Full replace (877 rows = trivial)

#### 7. Galactapedia

```sql
CREATE TABLE galactapedia (
    uuid TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    thumbnail_url TEXT,
    related_articles TEXT, -- JSON array of UUIDs
    tags TEXT, -- JSON array of strings
    game_version TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_galactapedia_slug ON galactapedia(slug);

-- PostgreSQL only (full-text search)
CREATE INDEX idx_galactapedia_content_fts ON galactapedia USING GIN (to_tsvector('english', content)); -- if driver == postgres
```

**Rationale**:
- **Content as TEXT**: Markdown, 1-50 KB per article. No further normalization.
- **Related articles as JSON**: Small arrays (3-10 UUIDs), not worth junction table overhead.

**SQLite limitation**: No full-text search (FTS5 requires separate virtual table). Deferred until user requests it.

**Sync strategy**: Incremental via If-Modified-Since (1,477 articles = worth optimizing)

#### 8. Shops

```sql
CREATE TABLE shops (
    uuid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    type TEXT,
    location_uuid TEXT REFERENCES celestial_objects(uuid) ON DELETE SET NULL,
    description TEXT,
    game_version TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shops_slug ON shops(slug);
CREATE INDEX idx_shops_location ON shops(location_uuid);
```

**Sync strategy**: Full replace (300 rows = trivial)

#### 9. Shop Inventory (Junction)

```sql
CREATE TABLE shop_inventory (
    shop_uuid TEXT NOT NULL REFERENCES shops(uuid) ON DELETE CASCADE,
    item_uuid TEXT NOT NULL REFERENCES items(uuid) ON DELETE CASCADE,
    price DECIMAL(10,2),
    quantity INTEGER,
    PRIMARY KEY (shop_uuid, item_uuid)
);

CREATE INDEX idx_shop_inventory_shop ON shop_inventory(shop_uuid);
CREATE INDEX idx_shop_inventory_item ON shop_inventory(item_uuid);
```

**Rationale**: Many-to-many with price/quantity metadata. Prices change frequently (out of scope for nightly sync).

**Sync strategy**: Per-shop DELETE + INSERT

#### 10. Commodities

```sql
CREATE TABLE commodities (
    uuid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    type TEXT,
    description TEXT,
    game_version TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_commodities_slug ON commodities(slug);
```

**Sync strategy**: Full replace (150 rows = trivial)

#### 11. Sync Metadata (Existing Table)

```sql
CREATE TABLE sync_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL UNIQUE,
    last_synced_at TIMESTAMP,
    last_modified TEXT, -- Store Last-Modified header for conditional requests
    status TEXT,
    error_message TEXT,
    records_synced INTEGER DEFAULT 0
);
```

**Rationale**: Already exists for FleetYards sync. Extend to track SC Wiki API categories.

**Categories**: vehicles, items, manufacturers, celestial_objects, galactapedia, shops, commodities

**Conditional requests**: Store `Last-Modified` response header, send as `If-Modified-Since` on next sync. API returns 304 if unchanged.

### Cross-Cutting Concerns

#### Game Version Tracking

**Design decision**: Store `game_version` column on all entities, but **do not enforce uniqueness**. Only latest version stored.

**Rationale**:
- Simplifies queries (no version filtering required)
- Historical queries deferred until user requests it
- 95% of use cases: "show me current game data"

**Future extension point**: Add `valid_from`/`valid_to` timestamps if historical tracking needed.

#### Dual-Driver Abstraction

**Existing helpers** (in `internal/database/database.go`):
```go
func placeholder(n int) string // "?" for SQLite, "$n" for PostgreSQL
func autoIncrement() string // "AUTOINCREMENT" vs "SERIAL"
func onConflictUpdate() string // "ON CONFLICT" clause differences
```

**New helper needed**:
```go
func jsonType() string {
    if db.driver == "postgres" {
        return "JSONB"
    }
    return "TEXT"
}
```

**Migration logic**:
```go
if db.driver == "postgres" {
    // Create GIN indexes on items.metadata, galactapedia.content
}
```

#### Sync Failure Recovery

**Transactional sync** per category:
```go
tx, _ := db.Begin()
defer tx.Rollback() // Rollback if any error

// DELETE FROM vehicles WHERE game_version != ?
// INSERT INTO vehicles VALUES (...)
// UPDATE sync_status SET last_synced_at = NOW()

tx.Commit()
```

**Partial sync resilience**: If vehicles sync fails, items sync still runs. Each category independent.

**Retry strategy**: Sync cron job logs failures, next run retries. No exponential backoff (nightly schedule has 24-hour buffer).

#### Indexing Strategy

**Principles**:
1. Index all foreign keys (JOIN performance)
2. Index common WHERE filters (slug, type, size, manufacturer)
3. No composite indexes yet (defer until query patterns proven)
4. PostgreSQL: GIN indexes on JSONB/FTS columns

**SQLite-specific**: Fewer indexes (simpler query planner). PostgreSQL: more indexes (smarter planner utilizes them).

#### LLM Context Queries

**Anticipated patterns**:
```sql
-- Ship detail with components
SELECT v.*, h.*, i.*
FROM vehicles v
LEFT JOIN hardpoints h ON h.vehicle_uuid = v.uuid
LEFT JOIN items i ON i.uuid = h.equipped_item_uuid
WHERE v.slug = 'carrack';

-- All ships by manufacturer
SELECT * FROM vehicles WHERE manufacturer_uuid = (
    SELECT uuid FROM manufacturers WHERE slug = 'anvil'
);

-- Items by type
SELECT * FROM items WHERE type = 'WeaponGun' AND size >= 4;

-- Celestial object hierarchy
WITH RECURSIVE tree AS (
    SELECT * FROM celestial_objects WHERE slug = 'stanton'
    UNION ALL
    SELECT co.* FROM celestial_objects co
    JOIN tree ON co.parent_uuid = tree.uuid
)
SELECT * FROM tree;
```

**Design supports**: All queries use indexed columns. Recursive CTE for hierarchies. JOINs on FK indexes.

## Trade-offs

### Normalize Hardpoints
**Decision**: Extract hardpoints to separate table instead of storing as JSON in vehicles.

**Gave up**:
- Simpler sync (single JSON blob)
- Atomic reads (one row = all data)

**Got**:
- Query individual hardpoints (filter by category, size)
- 680 KB payloads removed from vehicles table
- Hardpoint changes don't invalidate vehicle cache

**Why**: Read performance for "all ships" queries matters more than single-ship detail atomicity.

### Denormalize Item Metadata
**Decision**: Store type-specific fields in JSONB/TEXT column instead of separate tables per item type.

**Gave up**:
- Type safety (weapons.dps vs shields.hp enforced by schema)
- SQLite index on metadata fields

**Got**:
- 19 item types → one table (schema stability)
- Fast writes (no 19-table fan-out)
- PostgreSQL GIN index covers all metadata queries

**Why**: Item schema evolves with every patch. Rigid type tables would require constant migrations.

### Current Version Only
**Decision**: Store only latest game version, not historical.

**Gave up**:
- Historical queries ("what was Carrack's loadout in 3.18?")
- Patch comparison analysis

**Got**:
- Simple queries (no version filtering)
- 50% smaller DB (no duplicate entities across versions)
- Deferred complexity until needed

**Why**: 95% of use cases are "show me current data". Historical tracking adds cost now for uncertain future value.

### Full-Text Search PostgreSQL Only
**Decision**: Full-text search on galactapedia content only available in PostgreSQL.

**Gave up**:
- SQLite full-text search (FTS5 virtual tables possible but complex)

**Got**:
- Simple implementation (PostgreSQL built-in)
- Deferred work (SQLite users can request later)

**Why**: Galactapedia search is nice-to-have, not core feature. PostgreSQL users get bonus feature.

## Alternatives Considered

### Full Denormalization (NoSQL-style)
**Approach**: Store entire API payloads as JSON blobs (one row per vehicle = entire hardpoints tree).

**Rejected because**:
- 680 KB rows violate PostgreSQL TOAST threshold (compression overhead)
- SQLite page size limits (32 KB default, large blobs degrade performance)
- LLM context queries require extracting nested data (complex JSON path queries)

**When it would make sense**: If queries were always "get entire vehicle" with no filtering. But we need "all ships with S5 shields" etc.

### Separate Tables Per Item Type
**Approach**: `weapon_items`, `shield_items`, `cooler_items` tables with type-specific columns.

**Rejected because**:
- 19 item types × schema changes per patch = migration hell
- Queries across types require UNION ALL
- Polymorphic queries ("show all items by manufacturer") require views

**When it would make sense**: If item schema was stable and type-specific queries dominant. Research shows mixed query patterns.

### Historical Version Tracking
**Approach**: Composite primary keys (uuid, game_version), temporal tables, or append-only design.

**Rejected for now because**:
- 2× storage (duplicate entities across versions)
- All queries need version filtering (complexity leak)
- Uncertain value (user hasn't requested it)

**Extension point**: Can add later via `valid_from`/`valid_to` timestamps without full schema rewrite.

### Graph Database
**Approach**: Neo4j or ArangoDB for entity relationships.

**Rejected because**:
- Research shows 1-2 hop JOINs (graphs shine at 4+ hops)
- Adds deployment complexity (another container)
- No Go stdlib support (requires vendor SDK)

**When it would make sense**: If queries were "ships 3+ degrees separated from manufacturer X" or network analysis. Current queries are simple traversals.

## Risks and Mitigations

### Risk: Hardpoint Nesting Breaks Recursive Queries
**Scenario**: 13-level deep hardpoints cause CTE performance issues or stack overflow.

**Likelihood**: Medium (observed in Polaris)

**Mitigation**:
- Limit CTE recursion depth (SQLite: 100 default, PostgreSQL: 1000)
- Test with Polaris payload before production deployment
- Option: Flatten to max depth 5, store deeper levels as JSON

**Validation**: Load Polaris, run recursive query, measure time.

### Risk: Item Metadata Queries Slow on SQLite
**Scenario**: No JSONB index on SQLite means metadata queries scan 19K rows.

**Likelihood**: High

**Mitigation**:
- Accept as SQLite limitation
- Document recommendation: use PostgreSQL for item search features
- Option: Extract common metadata fields (dps, hp, cooling_rate) to columns if user reports slowness

**Validation**: Benchmark item metadata query on 19K rows. If >500ms, consider column extraction.

### Risk: Sync Failures Corrupt Partial Data
**Scenario**: Network failure mid-sync leaves vehicles updated but hardpoints stale.

**Likelihood**: Low (network stable, API reliable)

**Mitigation**:
- **Transactional sync**: Each category in transaction (rollback on error)
- **Idempotent sync**: Full replace per category (DELETE + INSERT, not UPDATE)
- **Validation query**: Post-sync count check (expected vs actual rows)

**Validation**: Simulate network failure during sync, verify rollback.

### Risk: Schema Evolution Breaks Migrations
**Scenario**: Game patch adds new vehicle field, migration fails on existing DBs.

**Likelihood**: Medium (patches monthly)

**Mitigation**:
- **Additive migrations only**: ADD COLUMN never DROP/ALTER
- **Null-safe queries**: Always handle missing fields gracefully
- **Version tracking**: Migration version table (already exists in database.go)

**Validation**: Run migration tests on SQLite and PostgreSQL before deployment.

### Risk: Large DB Slows LLM Context Fetches
**Scenario**: 185 MB DB (2031 projection) causes slow queries for LLM context enrichment.

**Likelihood**: Low (modern DBs handle this easily)

**Mitigation**:
- **Indexed queries**: All LLM queries use indexed columns
- **Materialized views**: If specific patterns emerge, pre-aggregate
- **Query timeout**: Set 5-second limit on LLM context queries

**Validation**: Benchmark queries on 200 MB synthetic dataset.

## Implementation Notes

### Migration Sequence
1. Add SC Wiki API tables (vehicles, items, manufacturers, etc.)
2. Migrate existing `ships` table data to `vehicles` (one-time)
3. Add `category` field to `sync_status` (extend existing table)
4. Keep existing `hangar_imports`, `ai_analyses` tables (no changes)

### Backward Compatibility
**Existing features unchanged**:
- FleetYards hangar sync still works (writes to `vehicles` table)
- HangarXplor import still works (writes to `vehicles` + `hangar_imports`)
- LLM analysis still works (reads from `vehicles`)

**New features enabled**:
- Ship database browser (read from `vehicles` + `hardpoints` + `items`)
- Component search (read from `items`)
- Star map viewer (read from `celestial_objects`)

### Dual-Driver Testing
**SQLite**: Default, must work flawlessly
**PostgreSQL**: Optional, test GIN indexes and JSONB performance

**Test matrix**:
- [ ] Sync all categories (SQLite)
- [ ] Sync all categories (PostgreSQL)
- [ ] Query vehicle with hardpoints (both)
- [ ] Query items with metadata filter (PostgreSQL)
- [ ] Recursive celestial object query (both)
- [ ] Galactapedia full-text search (PostgreSQL)

## Success Criteria

A skilled professional should be able to read this design and conclude:

- **Yep, this will work** for 22K entities and read-heavy queries
- **Yep, this will sync** nightly without complexity
- **Yep, this will scale** to 185 MB (5 years)
- **Yep, this will evolve** when game patches change schema

The simplest possible structure that serves reads well, keeps writes simple, and accommodates growth.

---

**Next step**: Implement migrations in `internal/database/migrations.go` and sync logic in `internal/scwiki/client.go`.
