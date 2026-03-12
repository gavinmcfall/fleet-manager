# Database Conventions — SC Companion (D1)

Rules for schema design in this project. Follow these when writing migrations or adding tables.

---

## Table Naming

- **snake_case, plural nouns** — `vehicles`, `fps_weapons`, `vehicle_components`
- **Namespace prefixes** group related tables:
  - `vehicle_*` — ship/vehicle items (`vehicle_components`, `vehicle_images`, `vehicle_loaners`)
  - `fps_*` — personal gear (`fps_weapons`, `fps_armour`, `fps_attachments`, `fps_utilities`)
  - `user_*` — per-user data (`user_fleet`, `user_paints`, `user_settings`, `user_rsi_profile`)
  - No prefix for core entities (`vehicles`, `paints`, `manufacturers`, `organizations`)

---

## Primary Keys

Always use:
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
```
Never use UUID as a primary key — D1 rowid lookups on INTEGER PK are significantly faster.

---

## UUIDs

When a row has a game-side UUID (DataCore, SC Wiki), store it as a separate column:
```sql
uuid TEXT NOT NULL UNIQUE
```
Never use UUID as PK. FK lookups use the integer `id`.

---

## Foreign Keys

Name format: `{singular_referenced_table}_id INTEGER REFERENCES {table}(id)`

Examples:
```sql
manufacturer_id INTEGER REFERENCES manufacturers(id)
fps_weapon_id   INTEGER REFERENCES fps_weapons(id)
vehicle_id      INTEGER REFERENCES vehicles(id)
```

---

## Junction Tables

Named `{table1}_{table2}` in alphabetical order:
- `paint_vehicles` (not `vehicle_paints`)
- Columns reference both parent tables by integer FK

---

## JSON Blob Columns

Use `{field}_json TEXT` for structured data that doesn't need querying/filtering:
```sql
containers_json TEXT   -- JSON array of container refs
shops_json      TEXT   -- JSON array of shop locations
```
Use sparingly — prefer proper columns for anything queried or filtered. **`stats_json` has been
eliminated** (migrations 0092 + 0099). All stat data now lives in dedicated typed columns on each table.

---

## Stat Column Conventions

### Resistance Profiles
Use `resist_` prefix for damage resistance columns:
```sql
resist_physical    REAL    -- physical damage resistance (0.0–1.0)
resist_energy      REAL    -- energy damage resistance
resist_distortion  REAL    -- distortion damage resistance
resist_thermal     REAL    -- thermal damage resistance
resist_biochemical REAL    -- biochemical damage resistance
resist_stun        REAL    -- stun damage resistance
```
Used by: `fps_armour`, `fps_helmets`, `fps_clothing`.

### Display Names
`display_name TEXT` for human-friendly names derived from localization files. Distinct from
`name TEXT` which stores the raw game entity name. Used by: `franchises`, `shops`.

### Controller Columns
`controller TEXT` + `controller_label TEXT` on `vehicle_ports` for mapping port→controller
relationships (e.g., which turret controls which weapon mount).

---

## Booleans

Use `INTEGER` with `DEFAULT 0`:
```sql
is_active INTEGER NOT NULL DEFAULT 0
```
Values: `0` = false, `1` = true. No SQLite `BOOLEAN` type.

---

## Timestamps

Use `TEXT` in ISO 8601 format. Default to `datetime('now')`:
```sql
updated_at TEXT DEFAULT (datetime('now'))
created_at TEXT DEFAULT (datetime('now'))
```

---

## Enum-like Values

For small, stable sets (production status, vehicle type), use a lookup table:
```sql
CREATE TABLE production_statuses (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  key   TEXT NOT NULL UNIQUE,   -- machine-readable: 'flight_ready'
  label TEXT NOT NULL           -- display: 'Flight Ready'
);
```
FK from the referencing table: `production_status_id INTEGER REFERENCES production_statuses(id)`

---

## Migrations

- Files: `src/db/migrations/NNNN_description.sql` (zero-padded 4-digit sequence)
- Apply: `npx wrangler d1 migrations apply sc-companion --remote`
- Never skip numbers or reuse applied migration names
- **Never alter PK or UNIQUE constraints in-place** — create new table, copy data, drop old
- D1 tracks applied migrations in `d1_migrations` table automatically
- **Known numbering collisions:** 0049 (two files) and 0051 (two files). D1 applied both in each case — do not rename or renumber as that would break the `d1_migrations` tracking table. Avoid future collisions by checking the latest file number before creating a new migration.

---

## Index Naming

Format: `idx_{table}_{column}` (or `idx_{table}_{col1}_{col2}` for composite)

Examples:
```sql
CREATE INDEX IF NOT EXISTS idx_loot_map_type     ON loot_map(type);
CREATE INDEX IF NOT EXISTS idx_loot_map_sub_type ON loot_map(sub_type);
```

---

## Out-of-Band Changes

Schema changes applied directly via `wrangler d1 execute` (not through a migration file) are
tracked in the session journal. They **do not** appear in `d1_migrations` and are not
re-applied by `wrangler d1 migrations apply`. Document them in the journal when applied.

As of migration `0037_patch_versioning`, all previously out-of-band columns were included in
table rebuilds. No current out-of-band columns exist.
