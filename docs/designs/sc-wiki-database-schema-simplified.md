---
description: Simplified database schema for Star Citizen ships and gear (no shops/lore)
tags: [database, schema, sc-wiki-api, design, simplified]
audience: { human: 60, agent: 40 }
purpose: { design: 80, gestalt: 20 }
---

# SC Wiki Database Schema - Simplified

## Context

Fleet Manager database design for Star Citizen ships and character gear, focused on **stats and capabilities** rather than lore or shop locations.

**Data source**: scunpacked-data repo at `/home/gavin/cloned-repos/StarCitizenWiki/scunpacked-data/`

**Scope**: Ships, components, weapons, armor - everything needed for fleet analysis and loadout planning.

**Out of scope**: Galactapedia (lore), celestial objects (locations), shops (deprecated), commodities (trading).

**Flows enabled**:
- Ship browser with component details
- Loadout planning (what fits where)
- Fleet gap analysis (expanded to component coverage)
- LLM context enrichment (ship capabilities, weapon stats)

## North Star

**Enable comprehensive fleet and loadout analysis with minimal complexity.**

Store only what's needed for understanding ship capabilities and planning loadouts. Fast queries for web UI and LLM, simple sync from scunpacked-data.

---

## Core Schema

### 1. Manufacturers

```sql
CREATE TABLE manufacturers (
    uuid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    known_for TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_manufacturers_code ON manufacturers(code);
```

**Source**: `/scunpacked-data/manufacturers.json`

**Sync strategy**: Full replace (124 rows = trivial)

**Key fields**:
- `uuid` - Primary key from API
- `code` - Short code (e.g., "ANVL", "AEGS", "MISC")
- `name` - Full name (e.g., "Anvil Aerospace")

---

### 2. Vehicles (Ships + Ground Vehicles)

```sql
CREATE TABLE sc_vehicles (
    uuid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    class_name TEXT,
    manufacturer_uuid TEXT REFERENCES manufacturers(uuid) ON DELETE SET NULL,
    size_class INTEGER,

    -- Categorization
    focus TEXT,
    type TEXT,
    is_spaceship BOOLEAN DEFAULT true,
    is_vehicle BOOLEAN DEFAULT false,
    is_gravlev BOOLEAN DEFAULT false,
    production_status TEXT,

    -- Dimensions
    length DECIMAL(10,2),
    width DECIMAL(10,2),
    height DECIMAL(10,2),

    -- Mass
    mass_hull DECIMAL(15,2),
    mass_loadout DECIMAL(15,2),
    mass_total DECIMAL(15,2),

    -- Cargo
    cargo_capacity DECIMAL(10,2),
    vehicle_inventory DECIMAL(10,2),

    -- Crew
    crew_min INTEGER,
    crew_max INTEGER,
    crew_weapon INTEGER,

    -- Health
    health DECIMAL(15,2),

    -- Speed (m/s)
    speed_scm DECIMAL(10,2),
    speed_max DECIMAL(10,2),

    -- Agility (degrees/sec)
    agility_pitch DECIMAL(10,2),
    agility_yaw DECIMAL(10,2),
    agility_roll DECIMAL(10,2),

    -- Shield
    shield_hp DECIMAL(15,2),
    shield_regen DECIMAL(10,2),
    shield_face_type TEXT,

    -- Metadata
    game_version TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sc_vehicles_manufacturer ON sc_vehicles(manufacturer_uuid);
CREATE INDEX idx_sc_vehicles_type ON sc_vehicles(type);
CREATE INDEX idx_sc_vehicles_focus ON sc_vehicles(focus);
CREATE INDEX idx_sc_vehicles_production_status ON sc_vehicles(production_status);
```

**Source**: `/scunpacked-data/ships/*.json` (individual ship files)

**Sync strategy**:
- Full sync weekly (288 files)
- Incremental possible via file modification times
- Parse each ship JSON and extract scalar fields

**Design notes**:
- Denormalized stats into columns for fast filtering/sorting
- Shield, speed, agility stats extracted from nested objects
- Ports/hardpoints extracted to separate table (see below)
- No `slug` field (not in scunpacked data, can generate if needed)

**Name conflict**: Renamed to `sc_vehicles` to avoid conflict with existing `vehicles` table from hangar imports.

---

### 3. Ports (Hardpoints)

```sql
CREATE TABLE sc_ports (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- SQLite / SERIAL for PostgreSQL
    uuid TEXT UNIQUE,
    vehicle_uuid TEXT NOT NULL REFERENCES sc_vehicles(uuid) ON DELETE CASCADE,
    parent_port_id INTEGER REFERENCES sc_ports(id) ON DELETE CASCADE,

    -- Port identification
    name TEXT NOT NULL,
    position TEXT,
    category_label TEXT,

    -- Port constraints
    size_min INTEGER,
    size_max INTEGER,

    -- Port type
    port_type TEXT,
    port_subtype TEXT,
    class_name TEXT,

    -- Equipped item
    equipped_item_uuid TEXT REFERENCES sc_items(uuid) ON DELETE SET NULL,

    -- Flags
    editable BOOLEAN,
    editable_children BOOLEAN,

    -- Metadata
    health DECIMAL(10,2),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sc_ports_vehicle ON sc_ports(vehicle_uuid);
CREATE INDEX idx_sc_ports_parent ON sc_ports(parent_port_id);
CREATE INDEX idx_sc_ports_item ON sc_ports(equipped_item_uuid);
CREATE INDEX idx_sc_ports_category ON sc_ports(category_label);
CREATE INDEX idx_sc_ports_type ON sc_ports(port_type);
```

**Source**: Nested in `/scunpacked-data/ships/*.json` as `ports[]` array

**Sync strategy**:
- Per-vehicle: DELETE all ports for vehicle, then INSERT new ports
- Recursive extraction: flatten `ports[].ports[]` tree into adjacency list
- `parent_port_id` tracks nesting hierarchy

**Design notes**:
- `id` is surrogate key (ports don't have independent UUIDs)
- `uuid` from API stored for reference but not used as PK
- `parent_port_id` enables recursive queries (turrets with sub-mounts)
- `equipped_item_uuid` links to items table (default loadout)
- Cascading delete: if vehicle deleted, all ports cascade

**Complexity contained**: Recursive nesting up to 13 levels. Represented as adjacency list, queries use recursive CTEs when needed.

---

### 4. Items (Components + Weapons + Armor)

```sql
CREATE TABLE sc_items (
    uuid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    manufacturer_uuid TEXT REFERENCES manufacturers(uuid) ON DELETE SET NULL,

    -- Classification
    type TEXT NOT NULL,
    sub_type TEXT,
    classification TEXT,
    size INTEGER,
    grade INTEGER,
    class TEXT,

    -- Dimensions
    width DECIMAL(10,4),
    height DECIMAL(10,4),
    length DECIMAL(10,4),
    mass DECIMAL(15,4),
    volume_scu DECIMAL(10,6),

    -- Description
    description TEXT,

    -- Type-specific data (JSONB for PostgreSQL, TEXT for SQLite)
    metadata TEXT, -- JSON: weapon stats, shield HP, cooler rate, etc.

    -- Flags
    is_base_variant BOOLEAN,

    -- Tags
    tags TEXT, -- JSON array

    -- Metadata
    game_version TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sc_items_manufacturer ON sc_items(manufacturer_uuid);
CREATE INDEX idx_sc_items_type ON sc_items(type);
CREATE INDEX idx_sc_items_sub_type ON sc_items(sub_type);
CREATE INDEX idx_sc_items_classification ON sc_items(classification);
CREATE INDEX idx_sc_items_size ON sc_items(size);
CREATE INDEX idx_sc_items_grade ON sc_items(grade);

-- PostgreSQL only (conditional in migration)
-- CREATE INDEX idx_sc_items_metadata_gin ON sc_items USING GIN (metadata::jsonb);
```

**Source**: Filter from:
- `/scunpacked-data/ship-items.json` (~2,853 ship components)
- `/scunpacked-data/fps-items.json` (~thousands of FPS weapons/armor)

**Item type filters** (include only):
- **Ship components**: Cooler, PowerPlant, QuantumDrive, Shield, Thruster, WeaponGun, WeaponMissile, etc.
- **FPS weapons**: WeaponPersonal.*
- **Armor**: Armor.*, Clothing.Torso/Legs/Arms/Helmet
- **Tools**: Tool.*, Medical.*

**Exclude**:
- Paints (can add later if needed)
- Decorations, furniture
- Food/drink
- Ship interior props
- Character emotes/animations

**Sync strategy**:
- Load ship-items.json and fps-items.json
- Filter by classification/type
- Full replace per sync (but can optimize with checksums)
- Store type-specific fields in `metadata` JSON

**Metadata examples**:
```json
// Weapon
{
  "damage": {"physical": 250, "energy": 0},
  "rate_of_fire": 450,
  "range": 2500,
  "ammo_capacity": 30
}

// Shield
{
  "hp": 12000,
  "regeneration": 50,
  "face_type": "FourFaces"
}

// Cooler
{
  "cooling_rate": 450000
}
```

**Design notes**:
- `metadata` as JSON avoids 19+ type-specific tables
- PostgreSQL: GIN index enables fast JSON queries
- SQLite: Full table scan for metadata queries (acceptable for 4K items)

---

### 5. Vehicle Loaners (Many-to-Many)

```sql
CREATE TABLE sc_vehicle_loaners (
    vehicle_uuid TEXT NOT NULL REFERENCES sc_vehicles(uuid) ON DELETE CASCADE,
    loaner_uuid TEXT NOT NULL REFERENCES sc_vehicles(uuid) ON DELETE CASCADE,
    PRIMARY KEY (vehicle_uuid, loaner_uuid)
);

CREATE INDEX idx_sc_vehicle_loaners_vehicle ON sc_vehicle_loaners(vehicle_uuid);
CREATE INDEX idx_sc_vehicle_loaners_loaner ON sc_vehicle_loaners(loaner_uuid);
```

**Source**: **TBD** - needs verification in scunpacked-data

**Sync strategy**: If loaners data exists, per-vehicle DELETE + INSERT

**Design notes**:
- Self-referencing many-to-many (vehicle references another vehicle)
- Example: Carrack (vehicle_uuid) includes Pisces (loaner_uuid)

**Action required**: Verify if loaner data exists in scunpacked ship files before implementing.

---

### 6. Sync Metadata

```sql
CREATE TABLE sc_sync_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL UNIQUE,
    last_synced_at TIMESTAMP,
    file_checksum TEXT, -- Git commit hash or file hash
    status TEXT,
    error_message TEXT,
    records_synced INTEGER DEFAULT 0
);
```

**Categories**:
- `manufacturers`
- `vehicles`
- `items_ship`
- `items_fps`
- `loaners`

**Sync approach**:
1. Check scunpacked-data repo git commit hash
2. If changed since last sync, run full sync
3. Update `file_checksum` with current commit hash
4. Store sync status and record counts

---

## Foreign Key Relationships

| Child Table | Parent Table | FK Column | Relationship | Cascade |
|-------------|--------------|-----------|--------------|---------|
| sc_vehicles | manufacturers | manufacturer_uuid | Many-to-One | SET NULL |
| sc_ports | sc_vehicles | vehicle_uuid | Many-to-One | CASCADE |
| sc_ports | sc_ports | parent_port_id | Self-Ref | CASCADE |
| sc_ports | sc_items | equipped_item_uuid | Many-to-One | SET NULL |
| sc_items | manufacturers | manufacturer_uuid | Many-to-One | SET NULL |
| sc_vehicle_loaners | sc_vehicles | vehicle_uuid | Many-to-Many | CASCADE |
| sc_vehicle_loaners | sc_vehicles | loaner_uuid | Many-to-Many | CASCADE |

**All FKs verified** against OpenAPI spec and scunpacked-data structure.

---

## Data Volumes

| Table | Estimated Rows | Avg Size | Total Size |
|-------|----------------|----------|------------|
| manufacturers | 124 | 1 KB | 124 KB |
| sc_vehicles | 288 | 2 KB | 576 KB |
| sc_ports | ~8,000 | 0.5 KB | 4 MB |
| sc_items | ~4,000 | 3 KB | 12 MB |
| sc_vehicle_loaners | ~100 | 0.1 KB | 10 KB |
| **Total** | **~12,512** | - | **~17 MB** |

**5-year projection**: ~25 MB (vehicles grow 15-25/year, items grow 10-30%)

**Comparison to original design**:
- Original: 22,504 entities, 90 MB
- Simplified: 12,512 entities, 17 MB
- **Reduction: 80% fewer rows, 81% smaller**

---

## Sync Strategy

### Data Source: scunpacked-data Repo

**Location**: `/home/gavin/cloned-repos/StarCitizenWiki/scunpacked-data/`

**Update frequency**: Within hours of live game patches (community-maintained)

**Advantages**:
- Already extracted from Data.p4k
- Already in JSON format
- No API rate limits (local files)
- Same data as api.star-citizen.wiki uses

### Sync Implementation

**1. Git Pull**
```bash
cd /home/gavin/cloned-repos/StarCitizenWiki/scunpacked-data
git pull origin master
```

**2. Check for Updates**
```go
currentCommit := exec("git rev-parse HEAD")
lastCommit := db.GetSyncChecksum("scunpacked")
if currentCommit == lastCommit {
    return // No updates
}
```

**3. Sync Manufacturers**
```go
data := readJSON("manufacturers.json")
tx.Exec("DELETE FROM manufacturers")
for _, m := range data {
    tx.Exec("INSERT INTO manufacturers ...", m.UUID, m.Name, m.Code)
}
```

**4. Sync Vehicles**
```go
files := listFiles("ships/*.json")
for _, file := range files {
    ship := readJSON(file)
    tx.Exec("INSERT INTO sc_vehicles ...", ship.UUID, ship.Name, ...)

    // Extract ports recursively
    syncPorts(tx, ship.UUID, ship.Ports, nil)
}
```

**5. Sync Items (Filtered)**
```go
shipItems := readJSON("ship-items.json")
fpsItems := readJSON("fps-items.json")

tx.Exec("DELETE FROM sc_items")

for _, item := range shipItems {
    if isRelevantType(item.Type) {
        metadata := extractMetadata(item)
        tx.Exec("INSERT INTO sc_items ...", item.UUID, ..., metadata)
    }
}

for _, item := range fpsItems {
    if isRelevantType(item.Classification) {
        metadata := extractMetadata(item)
        tx.Exec("INSERT INTO sc_items ...", item.UUID, ..., metadata)
    }
}
```

**6. Update Sync Status**
```go
tx.Exec("UPDATE sc_sync_status SET last_synced_at = ?, file_checksum = ?, records_synced = ?",
    time.Now(), currentCommit, recordCount)
tx.Commit()
```

**Sync Schedule**:
- **Manual trigger** from UI (initial implementation)
- **Nightly cron** (future enhancement)
- **Webhook** from scunpacked-data repo (if available)

**Error Handling**:
- Transactional sync (rollback on error)
- Log failures with context
- Retry on next sync attempt
- Validation: count checks, FK integrity

---

## Integration with Existing Tables

**Existing tables** (from FleetYards/HangarXplor):
- `vehicles` - User's hangar (imports from FleetYards or HangarXplor)
- `hangar_imports` - Insurance/pledge data from HangarXplor
- `ships` - FleetYards ship database (DEPRECATED - replace with sc_vehicles)

**New tables** (SC Wiki data):
- `sc_vehicles` - All Star Citizen ships (reference data)
- `sc_ports` - Hardpoints/loadouts
- `sc_items` - Components, weapons, armor

**Migration path**:
1. Keep existing `vehicles` table (user's hangar)
2. Deprecate `ships` table (old FleetYards reference)
3. Add `sc_vehicles` as new reference table
4. Update UI to query `sc_vehicles` instead of `ships`
5. Eventually: migrate `vehicles.ship_slug` to reference `sc_vehicles.uuid` (breaking change)

**Ship matching**:
- User vehicles (from hangar) → sc_vehicles via slug matching
- `FindShipSlug()` logic still applies
- Join user vehicles → sc_vehicles to get full stats

---

## Query Examples

### Ship Detail with Loadout
```sql
SELECT
    v.*,
    p.name AS port_name,
    p.category_label,
    p.size_min,
    p.size_max,
    i.name AS equipped_item_name,
    i.type AS item_type
FROM sc_vehicles v
LEFT JOIN sc_ports p ON p.vehicle_uuid = v.uuid
LEFT JOIN sc_items i ON i.uuid = p.equipped_item_uuid
WHERE v.uuid = ?
ORDER BY p.id;
```

### Ships by Manufacturer
```sql
SELECT v.*, m.name AS manufacturer_name
FROM sc_vehicles v
JOIN manufacturers m ON m.uuid = v.manufacturer_uuid
WHERE m.code = 'ANVL'
ORDER BY v.name;
```

### Items by Type and Size
```sql
SELECT * FROM sc_items
WHERE type = 'Shield'
  AND size >= 2
ORDER BY grade DESC, name;
```

### Recursive Port Query (All Ports for Vehicle)
```sql
WITH RECURSIVE port_tree AS (
    -- Root ports
    SELECT * FROM sc_ports
    WHERE vehicle_uuid = ? AND parent_port_id IS NULL

    UNION ALL

    -- Child ports
    SELECT p.* FROM sc_ports p
    JOIN port_tree pt ON p.parent_port_id = pt.id
)
SELECT * FROM port_tree
ORDER BY id;
```

### Ships Missing Component Type
```sql
-- Ships without a quantum drive equipped
SELECT v.name, v.uuid
FROM sc_vehicles v
WHERE NOT EXISTS (
    SELECT 1 FROM sc_ports p
    JOIN sc_items i ON i.uuid = p.equipped_item_uuid
    WHERE p.vehicle_uuid = v.uuid
      AND i.type = 'QuantumDrive'
);
```

---

## Trade-offs

### Metadata as JSON vs Normalized Tables

**Decision**: Store type-specific fields (DPS, shield HP, cooling rate) in JSON `metadata` column.

**Gave up**:
- Type safety (no schema enforcement)
- Fast indexed queries on metadata fields (SQLite)

**Got**:
- Schema stability (no migrations when item types change)
- Single items table (vs 19+ type tables)
- PostgreSQL GIN index covers all metadata queries

**Why**: Item schema evolves with every game patch. 19 item types × frequent schema changes = migration hell. JSON is flexible enough.

### Current Version Only

**Decision**: Store only latest game version, no historical tracking.

**Gave up**:
- Historical queries ("what was Carrack loadout in 3.18?")
- Patch comparison

**Got**:
- Simple queries (no version filtering)
- 50% smaller DB
- Deferred complexity

**Why**: 95% of queries are "current stats". Historical tracking adds cost now for uncertain future value.

### Full Replace Sync vs Incremental

**Decision**: Full replace per category on each sync.

**Gave up**:
- Bandwidth optimization (re-downloading unchanged data)
- Sync speed for large datasets

**Got**:
- Idempotent sync (no diff logic)
- Simple implementation
- Guaranteed consistency

**Why**: Dataset is small (17 MB). Full sync takes <30 seconds. Complexity of incremental sync not worth it.

---

## Risks and Mitigations

### Risk: Scunpacked-data Repo Outdated

**Scenario**: Community stops maintaining scunpacked-data.

**Likelihood**: Low (active project, 28 stars, recent commits)

**Mitigation**:
- Fallback to api.star-citizen.wiki API
- Extract directly from Data.p4k using custom tools
- Accept stale data until alternative source found

### Risk: Item Metadata Queries Slow on SQLite

**Scenario**: JSON queries scan 4K rows without index.

**Likelihood**: Medium

**Mitigation**:
- Accept as SQLite limitation (<100ms for 4K rows)
- Recommend PostgreSQL for advanced filtering
- Option: Extract frequently-queried fields (DPS, HP) to columns if slow

**Validation**: Benchmark on 4K items. If >500ms, add indexed columns.

### Risk: Recursive Port Queries Hit Depth Limit

**Scenario**: 13-level deep ports exceed CTE recursion limit.

**Likelihood**: Low (Polaris has deepest nesting, should work)

**Mitigation**:
- Test with Polaris ports before production
- SQLite default: 100 recursion depth (sufficient)
- Option: Flatten to max depth 5, store rest as JSON

**Validation**: Load Polaris, run recursive CTE, measure time.

### Risk: Sync Failures Leave Partial Data

**Scenario**: Git pull succeeds but JSON parsing fails mid-sync.

**Likelihood**: Low (JSON is validated by scunpacked)

**Mitigation**:
- Transactional sync (rollback on error)
- Validation query post-sync (count checks)
- Retry on next sync attempt

---

## Success Criteria

- ✅ All ship stats queryable (speed, shields, cargo, crew)
- ✅ All loadouts browsable (what's equipped where)
- ✅ All components searchable (by type, size, grade, manufacturer)
- ✅ Fleet analysis enhanced (component coverage, not just ship roles)
- ✅ LLM context enriched (ship capabilities, weapon comparisons)
- ✅ Sync completes in <60 seconds
- ✅ Queries return in <100ms
- ✅ Database under 25 MB

**Simple, focused, and complete** for the use case: fleet management and loadout planning.

---

**Next step**: Implement migrations in `internal/database/migrations.go` and sync client in `internal/scwiki/sync.go`.
