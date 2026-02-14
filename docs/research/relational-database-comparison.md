---
description: Relational database comparison for Star Citizen fleet management app -- SQLite, PostgreSQL, MySQL/MariaDB
tags: [database, sqlite, postgresql, mysql, mariadb, performance, self-hosted, kubernetes]
audience: { human: 60, agent: 40 }
purpose: { research: 85, reference: 15 }
---

# Relational Database Comparison for Fleet Manager

Research for selecting or confirming the relational database backing the fleet-manager app.

*Research date: 2026-02-14*

## Context

Fleet-manager is a self-hosted Star Citizen fleet management app running on a homelab Kubernetes cluster (TalosOS, Flux GitOps, BJW-S app-template). The codebase already supports SQLite (default) and PostgreSQL. The question is whether that pairing is well-suited, and how MySQL/MariaDB compares as a third option.

**Workload profile:**
- Read-heavy web serving (single user, sub-100ms page load goal)
- Periodic bulk writes (nightly API syncs from FleetYards and SC Wiki -- hundreds to low-thousands of rows)
- Data is a mix of structured ship specs, TEXT columns holding JSON blobs (`raw_json`, `data`), and relational JOINs (vehicles to ships, vehicles to hangar_imports)
- Dataset size is small: ~200-300 ships in reference DB, ~38 user vehicles, plus SC Wiki data (items, galactapedia, comm links, celestial objects, starsystems)
- LLM access pattern: Claude reading fleet data for analysis via API or MCP

**What this research covers:** Performance characteristics, deployment complexity, JSON handling, backup/restore, schema migration tooling, and LLM integration patterns for each database.

**What this research does not cover:** Graph databases, vector databases, search engines, or analytics-specific databases.

---

## SQLite

### Performance

SQLite is an embedded database. Queries execute in-process with no network round-trip, no connection protocol overhead, and no serialization/deserialization between client and server. For the fleet-manager workload (single user, read-heavy, small dataset), this architecture provides significant latency advantages.

**Read performance:** SQLite handles 100k+ SELECTs per second with WAL mode and proper tuning. Concurrent readers are unlimited; reads are never blocked by writes in WAL mode.

> [phiresky -- SQLite performance tuning](https://phiresky.github.io/blog/2020/sqlite-performance-tuning/) -- Demonstrates 100k SELECTs/s with concurrent readers and multi-GB databases

> [PowerSync -- SQLite Optimizations for Ultra High-Performance](https://www.powersync.com/blog/sqlite-optimizations-for-ultra-high-performance) -- Sub-microsecond query times with pooling, page cache tuning, and prepared queries

**Write performance:** Single-writer limitation. Only one write transaction at a time. In WAL mode with `synchronous=NORMAL`, SQLite handles 70k-100k write transactions per second for typical record sizes. Bulk inserts are fast when batched in a single transaction.

> [Oldmoe -- The Write Stuff: Concurrent Write Transactions in SQLite](https://oldmoe.blog/2024/07/08/the-write-stuff-concurrent-write-transactions-in-sqlite/) -- Single-writer detailed analysis

> [SQLite WAL documentation](https://sqlite.org/wal.html) -- WAL mode allows readers and writers to operate concurrently

**For the fleet-manager nightly sync:** The sync job writes a few hundred rows in a single transaction. At SQLite's write throughput, this completes in milliseconds. Web readers are not blocked during WAL-mode writes. The current codebase already uses WAL mode (`?_journal_mode=WAL`) and sets `MaxOpenConns(1)`.

**Real-world scale reference:** The sqlite.org website itself handles 400k-500k HTTP requests/day, with ~15-20% being dynamic pages touching the database (~200 SQL statements per page), running on a single VM with load average below 0.1.

> [SQLite -- Appropriate Uses](https://www.sqlite.org/whentouse.html) -- Official guidance on when SQLite is and is not appropriate

### JSON Support

SQLite gained JSONB support in version 3.45.0 (January 2024). Prior to that, JSON functions (`json_extract`, `json_each`, `json_array_length`) operated on TEXT columns containing JSON strings.

**SQLite JSONB:** Stores the internal binary parse-tree representation on disk, skipping parse/stringify on every read. The SQLite documentation states this is "several times faster" than text JSON for extraction operations. However, SQLite JSONB has O(N) lookup complexity for object keys (scans through keys), unlike PostgreSQL JSONB which claims O(1) key lookup.

> [SQLite -- The JSONB Format](https://sqlite.org/jsonb.html) -- Binary format specification and performance characteristics

> [Fedora Magazine -- JSON and JSONB support in SQLite 3.45.0](https://fedoramagazine.org/json-and-jsonb-support-in-sqlite-3-45-0/) -- Practical overview of the new JSONB support

**Indexing JSON:** SQLite can create indexes on expressions including `json_extract()`, enabling indexed lookups on specific JSON paths. However, there is no equivalent to PostgreSQL's GIN index that indexes all keys/values in a JSON document at once.

**Fleet-manager relevance:** The current codebase stores JSON in TEXT columns (`raw_json` on ships, `data` on SC Wiki tables). These columns are not queried with JSON functions in existing code -- they are stored and retrieved as opaque blobs. JSON query performance matters only if future features need to query inside these blobs.

### Deployment Complexity

SQLite requires no separate server process. The database is a single file on disk. In Kubernetes, this means:

- No StatefulSet for a database server
- No connection pooling (PgBouncer, etc.)
- No operator (CloudNativePG, etc.)
- The app pod has a PersistentVolumeClaim; the `.db` file lives on it
- Zero memory overhead beyond what the app process uses
- Compatible with BJW-S app-template without additional chart dependencies

**Resource overhead:** SQLite uses memory proportional to the page cache size configured. The default is 2MB. The fleet-manager dataset fits comfortably in a few megabytes of cache.

### Backup and Restore

**Single-file simplicity:** The entire database is one file. Backup approaches:

1. **`sqlite3 .backup`** -- SQLite's built-in backup command creates an atomic, consistent copy even while the database is in use.
2. **`VACUUM INTO`** -- Creates an optimized copy of the database to a target file.
3. **File copy** -- Safe when using WAL mode with a checkpoint, or when the application is stopped.
4. **Litestream** -- Streaming replication tool that runs as a sidecar in Kubernetes. Continuously replicates WAL changes to S3-compatible storage (including MinIO on the local cluster). Restoration is automatic via an init container.

> [Litestream -- Running in a Kubernetes cluster](https://litestream.io/guides/kubernetes/) -- Sidecar pattern with StatefulSet for automated backup/restore

> [Oldmoe -- Backup strategies for SQLite in production](https://oldmoe.blog/2024/04/30/backup-strategies-for-sqlite-in-production/) -- Comprehensive comparison of backup methods

> [monotux.tech -- SQLite, Kubernetes & Litestream](https://www.monotux.tech/posts/2025/05/sqlite-kubernetes-sts/) -- Practical self-hosted deployment experience

**Limitation:** Litestream currently supports only a single node per StatefulSet (no read replicas). This is irrelevant for fleet-manager's single-user workload.

### Schema Migrations

SQLite's `ALTER TABLE` has historically been limited. Current status (SQLite 3.35+):
- `ADD COLUMN` -- supported
- `RENAME COLUMN` -- supported (since 3.25)
- `DROP COLUMN` -- supported (since 3.35)
- `ALTER COLUMN` (change type, constraints) -- **not supported**. Requires the "12-step" process: create new table, copy data, drop old, rename.

> [SQLite -- ALTER TABLE](https://www.sqlite.org/lang_altertable.html) -- Official documentation of supported operations

**Go migration tooling:** Goose, golang-migrate, and Atlas all support SQLite. Atlas can generate migration plans that handle the 12-step table recreation transparently.

> [Goose GitHub](https://github.com/pressly/goose) -- Supports SQLite, Postgres, MySQL, and others

**Fleet-manager current approach:** The codebase uses `CREATE TABLE IF NOT EXISTS` with `ALTER TABLE ADD COLUMN` wrapped in error-ignoring blocks. This works but does not support column type changes or column drops via the migration system.

### Full-Text Search

SQLite provides FTS5, a built-in full-text search extension. FTS5 creates a virtual table with an inverted index. Index creation is ~40% faster than FTS3, retrieval ~30% faster.

> [SQLite -- FTS5 Extension](https://sqlite.org/fts5.html) -- Full specification

**Relevance:** If fleet-manager needs ship name search or galactapedia text search, FTS5 is available without external dependencies.

---

## PostgreSQL

### Performance

PostgreSQL uses a client-server architecture. Queries cross a network boundary (or Unix socket), pass through the connection handler, query planner, and executor.

**Read performance:** PostgreSQL's query planner and optimizer handle complex queries well. For simple key lookups on indexed columns, query execution is typically sub-millisecond. For the fleet-manager dataset (a few hundred rows), most queries will be served from shared_buffers (memory cache) and complete in low single-digit milliseconds.

**Write performance:** PostgreSQL supports concurrent writers through MVCC (Multi-Version Concurrency Control). Multiple transactions can write simultaneously without blocking each other (except on the same rows). For the fleet-manager's nightly sync of a few hundred rows, PostgreSQL handles this trivially.

**Network overhead:** Even on localhost, the connection protocol adds overhead versus SQLite's in-process calls. For a Kubernetes deployment where the database is in a separate pod, add network latency between pods (typically <1ms on the same node, potentially more across nodes).

> [SQLite -- Database Speed Comparison](https://www.sqlite.org/speed.html) -- Official benchmarks showing SQLite outperforming PostgreSQL on simple operations by factors of 2-10x

> [Hacker News discussion on SQLite vs Postgres local performance](https://news.ycombinator.com/item?id=32676455) -- Community benchmarks and discussion

### JSON/JSONB Support

PostgreSQL's JSONB is the most mature JSON implementation among relational databases.

**JSONB features:**
- Binary storage format with O(1) key lookup
- GIN indexes that index all keys and values in a document, enabling `@>` (containment) and `?` (key existence) operators
- `jsonb_path_ops` GIN operator class for optimized containment queries
- Full JSONPath support (`@?`, `@@` operators)
- Functions: `jsonb_set`, `jsonb_insert`, `jsonb_build_object`, `jsonb_agg`, `jsonb_to_record`
- Can be used as the basis for a document-store pattern within a relational schema

**GIN index performance:** Queries using GIN indexes on JSONB typically execute in 0.7-1.2ms for cached data per containment check.

> [Crunchy Data -- Indexing JSONB in Postgres](https://www.crunchydata.com/blog/indexing-jsonb-in-postgres) -- Practical indexing strategies

> [pganalyze -- Understanding Postgres GIN Indexes](https://pganalyze.com/blog/gin-index) -- Performance characteristics and tradeoffs

**Fleet-manager relevance:** The `raw_json` and `data` TEXT columns could be changed to JSONB in PostgreSQL mode, enabling direct SQL queries against JSON content (e.g., querying specific ship component data from the SC Wiki `data` column). This is a capability SQLite can approximate with `json_extract()` but without the same indexing power.

### Deployment Complexity

PostgreSQL in Kubernetes requires:

- A separate StatefulSet (or operator-managed cluster)
- Persistent volume for data directory
- Connection configuration (host, port, credentials)
- Memory allocation: ~10MB per connection, shared_buffers typically set to 25% of available RAM
- Idle connection overhead: each connection consumes ~1.3MB even when idle

> [AWS -- Resources consumed by idle PostgreSQL connections](https://aws.amazon.com/blogs/database/resources-consumed-by-idle-postgresql-connections/) -- Detailed memory profiling of idle connections

**Operator options for Kubernetes:**
- **CloudNativePG** (CNPG) -- Open source (Apache 2), manages full lifecycle including HA, backups, rolling updates. Integrates with Flux GitOps. Actively maintained by EDB.
- **Crunchy Data Postgres Operator** -- Production-grade with pgBackRest integration
- **Zalando Postgres Operator** -- Patroni-based HA

> [CloudNativePG](https://cloudnative-pg.io/) -- Kubernetes-native PostgreSQL management

**For a homelab single-user app:** Running a PostgreSQL operator adds an operator pod (memory/CPU overhead), a separate database pod, PVC management, and credential management. This is more infrastructure than the application itself requires for its workload.

### Backup and Restore

PostgreSQL offers multiple backup strategies:

1. **`pg_dump`** -- Logical backup. Produces SQL or custom-format archive. Can be run from kubectl exec against the pod.
2. **WAL archiving** -- Continuous physical backup. WAL segments pushed to S3/MinIO. Enables point-in-time recovery (PITR).
3. **pgBackRest** -- Dedicated backup tool with incremental backups, parallel compression, S3 support. Integrated with CloudNativePG and Crunchy operator.
4. **Kubernetes Volume Snapshots** -- Infrastructure-level backup of the PVC.

> [CloudNativePG -- Backup documentation](https://www.enterprisedb.com/docs/postgres_for_kubernetes/latest/backup/) -- Backup to S3 with scheduled backups

> [Medium -- Backup and Restore Strategies for PostgreSQL in Kubernetes](https://medium.com/@PlanB./backup-and-restore-strategies-for-postgresql-in-kubernetes-minio-cnpg-and-more-6b0d8ffcc8b4) -- CNPG + MinIO practical guide

**Advantage over SQLite:** PITR (point-in-time recovery) via WAL archiving. If something goes wrong at 2:47 AM, you can restore to 2:46 AM. SQLite backup methods are snapshot-based (you get the state at backup time, not arbitrary points).

**Tradeoff:** The backup infrastructure itself (operator, S3 bucket, scheduled backup CRDs) requires setup and maintenance.

### Schema Migrations

PostgreSQL supports the full `ALTER TABLE` specification:
- `ADD COLUMN`, `DROP COLUMN`, `RENAME COLUMN` -- all supported
- `ALTER COLUMN SET TYPE` -- type changes with optional `USING` expression
- `ALTER COLUMN SET/DROP DEFAULT`, `SET/DROP NOT NULL`
- `ADD CONSTRAINT`, `DROP CONSTRAINT`
- Transactional DDL -- schema changes can be rolled back within a transaction

> [PostgreSQL Documentation -- ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html) -- Complete specification

**Go migration tooling:** Goose, golang-migrate, and Atlas all have first-class PostgreSQL support. Atlas's declarative mode is particularly powerful with PostgreSQL since it can leverage the full ALTER TABLE capability.

### Full-Text Search

PostgreSQL provides `tsvector`/`tsquery` with GIN indexing. Supports language-aware stemming, ranking, phrase search, and weighted search.

**Performance:** With dedicated `tsvector` columns and GIN indexes (`fastupdate=off`), PostgreSQL FTS achieves approximately 50x speedup over on-the-fly `to_tsvector()` calls.

> [VectorChord -- PostgreSQL BM25 Full-Text Search](https://blog.vectorchord.ai/postgresql-full-text-search-fast-when-done-right-debunking-the-slow-myth) -- Optimization techniques for PostgreSQL FTS

---

## MySQL / MariaDB

### Performance

MySQL and MariaDB use the same client-server architecture as PostgreSQL. Both use InnoDB as the default storage engine with MVCC for concurrent access.

**Read performance:** For simple queries on small datasets, MySQL/MariaDB and PostgreSQL perform similarly. Both achieve sub-millisecond query times for indexed lookups on cached data.

**Write performance:** Both support concurrent writers through MVCC. For fleet-manager's workload, performance differences between MySQL/MariaDB and PostgreSQL are negligible.

### JSON Support

**MySQL 8.x:** Stores JSON in an optimized binary format (similar concept to PostgreSQL JSONB). Supports JSON functions (`JSON_EXTRACT`, `->`, `->>`). Does not directly index JSON columns. Workaround: generated columns that extract values from JSON, then index the generated columns. Multi-valued indexes available for JSON arrays.

**MariaDB:** Stores JSON as LONGTEXT internally. JSON functions are available but the underlying storage is text, not binary. MariaDB 11.8/12.0 has experimental binary JSON storage as an opt-in feature.

**Performance comparison (JSON path lookups):** One benchmark with 500M rows and ~1.2KB documents showed MySQL 8.4 achieving 18,000 JSON path lookups/sec per core versus MariaDB 11.6 at 4,200 JSON path lookups/sec per core. The gap narrows with caching and generated columns.

> [Genexdbs -- Bench-marking MySQL 8.4 vs MariaDB 11.8](https://genexdbs.com/bench-marking-mysql-8-4-vs-mariadb-11-8-which-is-better/) -- Detailed benchmark comparison

> [Red Gate -- JSON Data Types in MySQL and PostgreSQL](https://www.red-gate.com/simple-talk/databases/mysql-vs-postgresql-json-data-type/) -- JSON implementation comparison

**Compared to PostgreSQL JSONB:** PostgreSQL's GIN indexing on JSONB is more flexible than MySQL's generated-column approach. PostgreSQL supports containment queries (`@>`) and key existence (`?`) natively on JSONB with index support. MySQL requires extracting values to generated columns to achieve indexed access.

### Deployment Complexity

Similar to PostgreSQL: requires a separate server process, StatefulSet, PVC, credentials.

**Kubernetes operators:**
- Oracle MySQL Operator
- Percona Operator for MySQL
- MariaDB Operator

> [Percona -- Run MySQL in Kubernetes](https://www.percona.com/blog/run-mysql-in-kubernetes-solutions-pros-and-cons/) -- Operator comparison and deployment considerations

**Compared to PostgreSQL in the homelab context:** The Kubernetes operator ecosystem for MySQL/MariaDB is less mature than CloudNativePG for PostgreSQL. Fewer homelab community members document MySQL-on-Kubernetes compared to PostgreSQL.

### Backup and Restore

- `mysqldump` / `mariadb-dump` -- logical backup (analogous to `pg_dump`)
- `mysqlbackup` / `mariabackup` -- physical backup (analogous to pgBackRest)
- Binary log archiving -- continuous replication (analogous to WAL archiving)
- Kubernetes volume snapshots

Similar capabilities to PostgreSQL. Tooling maturity and community documentation are strong for both.

### Schema Migrations

MySQL/MariaDB support full `ALTER TABLE`:
- `ADD/DROP/MODIFY COLUMN`, `RENAME COLUMN`
- `ADD/DROP CONSTRAINT`
- Online DDL (some operations without locking the table)

**Caveat:** MySQL DDL is not transactional. A failed `ALTER TABLE` partway through can leave the schema in an inconsistent state. PostgreSQL's transactional DDL is safer.

> [Better Stack -- PostgreSQL vs MySQL vs MariaDB](https://betterstack.com/community/comparisons/postgresql-vs-mysql-vs-mariadb/) -- Feature comparison

**Go migration tooling:** Goose, golang-migrate, and Atlas all support MySQL and MariaDB.

### Fleet-Manager Integration Cost

The current codebase supports SQLite and PostgreSQL with driver-conditional logic (`db.driver == "postgres"`). Adding MySQL would require:

- A third branch for MySQL placeholder syntax (MySQL uses `?` like SQLite, so this is simpler)
- MySQL-specific `AUTO_INCREMENT` syntax (different from both SQLite and PostgreSQL)
- `ON DUPLICATE KEY UPDATE` instead of `ON CONFLICT ... DO UPDATE SET`
- MySQL-specific timestamp functions
- A new driver dependency (`go-sql-driver/mysql`)
- Testing across three database backends

---

## LLM Integration Patterns

How Claude (or other LLMs) can access fleet data stored in any of these databases:

### Pattern 1: API Endpoints (Current)

The fleet-manager already serves JSON via HTTP API endpoints. An LLM calls these endpoints (directly or through tool use) and receives structured JSON. The database choice is invisible to the LLM.

**Speed:** Determined by web request latency (database query time + HTTP overhead). For all three databases with this dataset size, API response time will be well under 100ms.

### Pattern 2: MCP Server

Model Context Protocol (MCP) servers provide database access to LLMs through a standardized interface. Available MCP servers exist for SQLite, PostgreSQL, and MySQL.

- [mcp-alchemy](https://github.com/runekaagaard/mcp-alchemy) -- Supports SQLite, PostgreSQL, MySQL, MariaDB, Oracle, MS-SQL via SQLAlchemy
- [postgres-mcp](https://github.com/crystaldba/postgres-mcp) -- PostgreSQL-specific with read/write modes
- [SQLite MCP servers](https://github.com/makeralchemy/claude-desktop-mcp-sqlite) -- Multiple implementations available

**Context window consideration:** MCP tool definitions consume context tokens. Each MCP server adds tool descriptions to the context. With many MCP servers, this can consume 10%+ of the context window before the conversation starts.

> [Scott Spence -- Optimising MCP Server Context Usage](https://scottspence.com/posts/optimising-mcp-server-context-usage-in-claude-code) -- Practical optimization strategies

### Pattern 3: Database Dump for Context

Export relevant data as JSON/CSV and include it in the LLM prompt. For fleet-manager's ~38 vehicles with ship specs, this is a few kilobytes of data -- trivially small relative to context windows.

**SQLite advantage:** The database file can be copied and queried directly by tools without needing a running server. An MCP server or CLI tool can open the `.db` file read-only.

**PostgreSQL/MySQL:** Requires either a running server or a `pg_dump`/`mysqldump` export step.

### Speed for LLM Access

The bottleneck for LLM data access is not database query time. It is:
1. Token processing speed (LLM inference)
2. Context window size (how much data can be included)
3. API call overhead (if using tool use / MCP)

For fleet-manager's data volume (<100KB of relevant data), all three databases provide the data faster than the LLM can process it.

---

## Comparison

| Dimension | SQLite | PostgreSQL | MySQL/MariaDB |
|-----------|--------|------------|---------------|
| **Query latency (simple SELECT, cached)** | Sub-microsecond to low microseconds | Low single-digit ms (includes connection) | Low single-digit ms (includes connection) |
| **Concurrent reads** | Unlimited (WAL mode) | Unlimited (MVCC) | Unlimited (InnoDB MVCC) |
| **Concurrent writes** | Single writer | Multiple concurrent writers | Multiple concurrent writers |
| **JSON storage** | TEXT or JSONB (3.45+) | JSONB (binary, O(1) key lookup) | Binary JSON (MySQL) / LONGTEXT (MariaDB) |
| **JSON indexing** | Expression indexes on json_extract() | GIN indexes on full document | Generated columns + B-tree index |
| **Full-text search** | FTS5 (built-in) | tsvector/tsquery + GIN | FULLTEXT index (InnoDB) |
| **ALTER TABLE completeness** | ADD/DROP/RENAME COLUMN only | Full ALTER TABLE, transactional DDL | Full ALTER TABLE, non-transactional DDL |
| **K8s deployment** | App pod + PVC only | Operator + DB pod + PVC + credentials | Operator + DB pod + PVC + credentials |
| **Backup (simplest)** | Copy file / `.backup` command | `pg_dump` to file | `mysqldump` to file |
| **Backup (production)** | Litestream to S3 | pgBackRest + WAL archiving to S3 | mariabackup + binlog to S3 |
| **Point-in-time recovery** | No (snapshot only) | Yes (WAL archiving) | Yes (binlog) |
| **Memory footprint (idle)** | ~2MB (page cache) | ~50-100MB (shared_buffers + per-connection) | ~50-100MB (buffer pool + per-connection) |
| **Go driver** | mattn/go-sqlite3 (CGO required) | jackc/pgx (pure Go available) | go-sql-driver/mysql (pure Go) |
| **Go driver CGO requirement** | Yes (CGO_ENABLED=1) | No | No |
| **Migration tooling (Go)** | Goose, Atlas, golang-migrate | Goose, Atlas, golang-migrate | Goose, Atlas, golang-migrate |
| **MCP server availability** | Multiple implementations | Multiple implementations | Via mcp-alchemy |
| **Already in fleet-manager** | Yes (default) | Yes (supported) | No |

---

## Gaps

- **Precise benchmark numbers for fleet-manager's exact query patterns** were not tested. The performance claims above are from general benchmarks. The actual latency of `GetVehiclesWithInsurance()` (which does a 3-table LEFT JOIN) on the fleet-manager dataset has not been measured for any database.

- **CGO cross-compilation impact** for SQLite was not researched in depth. The `mattn/go-sqlite3` driver requires CGO, which complicates cross-compilation and multi-arch container builds. There are pure-Go SQLite alternatives (modernc.org/sqlite) but their performance characteristics relative to the C implementation were not compared here.

- **MySQL/MariaDB community adoption in the homelab Kubernetes space** is anecdotal. The claim that PostgreSQL has stronger homelab community documentation than MySQL/MariaDB is based on search result density, not a systematic survey.

- **Litestream reliability in production** -- Litestream is widely discussed but hard data on failure modes and data loss incidents is sparse. The project is maintained by a single primary author (Ben Johnson).

- **PostgreSQL connection overhead** for a single-user app -- the 50-100MB memory estimate is conservative and based on default configurations. A tuned PostgreSQL instance for a single user could use less, but specific numbers for a minimal configuration were not found.

- **SQLite JSONB performance vs PostgreSQL JSONB** -- no direct head-to-head benchmark was found. The O(N) vs O(1) key lookup difference is documented by each project, but real-world impact for small JSON documents (fleet-manager's typical case) is unknown.

---

## Field Sentiment

**SQLite** has gained significant momentum as a production database for single-server web applications. Fly.io, Turso, and the Laravel ecosystem have driven adoption. The "SQLite is not just for testing" narrative is well-established in 2025-2026 developer discourse.

**PostgreSQL** remains the default choice for production web applications among most developer communities. Its ecosystem maturity, extension system, and JSONB capabilities make it a frequent recommendation. In the Kubernetes homelab community, CloudNativePG is the most commonly discussed database operator.

**MySQL/MariaDB** retains a large installed base but has less mindshare among newer projects. In the Kubernetes operator space, PostgreSQL operators are more frequently discussed in homelab contexts. MySQL's JSON handling is functional but less flexible than PostgreSQL's JSONB.

---

## Summary

| Question | SQLite | PostgreSQL | MySQL/MariaDB |
|----------|--------|------------|---------------|
| Can it handle fleet-manager's read load? | Yes, with large margin | Yes, with large margin | Yes, with large margin |
| Can it handle nightly bulk sync writes? | Yes (single transaction) | Yes | Yes |
| Deployment complexity for self-hosted K8s? | Minimal (app pod only) | Moderate (operator + DB pod) | Moderate (operator + DB pod) |
| JSON query capability? | Basic (expression-indexed json_extract) | Advanced (JSONB + GIN indexes) | Moderate (generated columns) |
| Sub-100ms web requests achievable? | Yes | Yes | Yes |
| LLM access speed bottleneck? | Not the database | Not the database | Not the database |
| Backup simplicity? | High (file copy / Litestream) | Moderate (pg_dump / CNPG) | Moderate (mysqldump / operator) |
| Already integrated? | Yes | Yes | No |
