---
description: Research into embedded database options for fleet-manager, informing whether to stay with SQLite or adopt alternatives
tags: [database, sqlite, duckdb, lancedb, meilisearch, typesense, embedded, search, vector, analytics]
audience: { human: 70, agent: 30 }
purpose: { research: 85, reference: 15 }
---

# Embedded Database Research

Research for deciding whether fleet-manager should stay with SQLite or adopt a different embedded database technology.

*Research date: 2026-02-14*

## Context

Fleet-manager is a single-user, self-hosted Star Citizen fleet management app running on Kubernetes (single-replica StatefulSet). The current database is SQLite with WAL mode enabled, `MaxOpenConns(1)`, and foreign keys on. The app has two workload patterns:

1. **Web serving** -- read-heavy. Ship lookups, fleet table rendering, insurance joins, analysis queries. Occasional bulk writes during imports (DELETE all + INSERT ~40 vehicles, plus ~200 ship upserts from FleetYards sync).
2. **Background sync** -- a cron job that bulk-upserts the entire FleetYards ship database (~600 ships) once daily at 3 AM, plus SC Wiki API data across 9 tables.

The dataset is small: ~600 ships in the reference DB, ~40 owned vehicles, ~40 hangar imports, plus SC Wiki data across multiple tables. Total database size is likely under 50 MB.

The question: is SQLite the right tool, or would DuckDB, LanceDB, Meilisearch, or Typesense serve this workload better?

---

## SQLite (Current)

### Architecture

Row-oriented, embedded, single-file database. Uses WAL (Write-Ahead Logging) mode in this project, enabled via connection string parameter `?_journal_mode=WAL&_foreign_keys=on`. The Go driver is `github.com/mattn/go-sqlite3`, which requires CGO.

> [SQLite WAL documentation](https://sqlite.org/wal.html) -- WAL provides concurrent reads with a single writer

### Performance

WAL mode benchmarks show ~70,000 reads/second and ~3,600 writes/second, compared to ~5,600 reads/second and ~291 writes/second in rollback journal mode. SQLite claims to be [35% faster than the filesystem](https://sqlite.org/fasterthanfs.html) for reading blobs smaller than 100 KB.

> [High Performance SQLite - WAL vs Journal benchmarks](https://highperformancesqlite.com/watch/wal-vs-journal-benchmarks) -- benchmarks showing WAL mode performance advantage

For fleet-manager's dataset size (~50 MB, ~600 reference ships, ~40 vehicles), SQLite queries return in sub-millisecond times. The JOIN in `GetVehiclesWithInsurance()` (vehicles LEFT JOIN ships LEFT JOIN hangar_imports) operates on tens of rows.

### Concurrency

Readers never block writers; writers never block readers in WAL mode. However, only one writer can proceed at a time. The current config enforces this with `SetMaxOpenConns(1)`.

For fleet-manager, write contention occurs only if a web import request arrives during the daily 3 AM cron sync. Given single-user usage, this is unlikely. If it does occur, SQLite's `busy_timeout` PRAGMA (not currently set) would handle it by retrying rather than immediately failing.

> [SQLite concurrency deep-dive](https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/) -- explains single-writer model and timeout strategies

### Full-Text Search

SQLite includes FTS5, a built-in full-text search extension. It supports prefix queries, phrase matching, and relevance ranking. The Go driver `mattn/go-sqlite3` supports FTS5 when compiled with the `-tags fts5` build tag.

For a ship database of ~600 records, FTS5 would provide instant typo-tolerant search without any additional service.

> [SQLite FTS5 documentation](https://sqlite.org/fts5.html) -- built-in full-text search

### Backup

SQLite is a single file. Backup strategies:

- **File copy** -- safe if the database is in WAL mode and no writes are in progress, or use the SQLite backup API
- **Litestream** -- streaming replication tool that runs as a sidecar, continuously replicating WAL changes to S3, Azure Blob, or SFTP. Designed for exactly this deployment pattern (single-replica StatefulSet on Kubernetes)
- **Volume snapshots** -- Kubernetes CSI snapshot support

> [Litestream - Kubernetes guide](https://litestream.io/guides/kubernetes/) -- sidecar deployment pattern
> [Harvest Engineering - SQLite on Kubernetes](https://www.getharvest.com/blog/running-sqlite-on-kubernetes-surprisingly-not-bad) -- production experience report

### LLM Access

An official SQLite MCP server exists, allowing Claude (via Claude Code or Claude Desktop) to connect to a SQLite database file directly and run queries. This is the most straightforward LLM access path of any option studied.

> [SQLite MCP Server](https://www.claudemcp.com/servers/sqlite) -- MCP server for direct SQLite access

### Limitations

- Single-writer model. Not suitable for multi-tenant or high-write-concurrency workloads.
- No native columnar analytics. Aggregation queries scan all rows.
- Requires CGO for Go (the `mattn/go-sqlite3` driver). This complicates cross-compilation.
- No built-in vector search or embedding support.
- No network access -- all processes must be on the same host.

### Current Code Observations

The fleet-manager codebase already abstracts the database driver with a `driver` field and helper methods (`placeholder()`, `autoIncrement()`, `onConflictUpdate()`), supporting both SQLite and PostgreSQL. All queries use standard SQL. The analysis module (`analysis.go`) operates entirely in Go memory after fetching all vehicles, not via SQL aggregation.

---

## DuckDB

### Architecture

Column-oriented, embedded analytical database. Designed for OLAP (Online Analytical Processing) workloads -- aggregations, GROUP BY, window functions, complex JOINs across large tables. Stores data in a columnar format optimized for scanning.

> [Why DuckDB](https://duckdb.org/why_duckdb) -- design philosophy and use cases

### Go Support

The Go bindings recently moved to official DuckDB maintenance at `github.com/duckdb/duckdb-go` (v2.5.0+). Like SQLite, it requires CGO. The bindings implement Go's `database/sql` interface, so the query patterns would be similar.

> [DuckDB Go Client](https://duckdb.org/docs/stable/clients/go) -- official documentation
> [go-duckdb on GitHub](https://github.com/duckdb/duckdb-go) -- official repository

### Performance

DuckDB can be 10-100x faster than SQLite for analytical queries on large datasets (millions of rows). Its vectorized execution engine processes data in batches rather than row-by-row.

However, for fleet-manager's dataset (~600 ships, ~40 vehicles), the overhead of columnar storage initialization likely exceeds the query time itself. The performance advantage materializes at scale -- thousands to millions of rows.

> [DuckDB vs SQLite - DataCamp](https://www.datacamp.com/blog/duckdb-vs-sqlite-complete-database-comparison) -- performance comparison
> [DuckDB vs SQLite - MotherDuck](https://motherduck.com/learn-more/duckdb-vs-sqlite-databases/) -- when to use which

### SQLite Interop

DuckDB can attach and query SQLite databases directly via its `sqlite` extension, without data migration:

```sql
INSTALL sqlite;
LOAD sqlite;
ATTACH 'fleet-manager.db' AS fm (TYPE sqlite);
SELECT * FROM fm.vehicles;
```

This means DuckDB could be used as an analytical overlay on an existing SQLite database -- no migration required.

> [DuckDB SQLite Extension](https://duckdb.org/docs/stable/core_extensions/sqlite) -- read/write SQLite from DuckDB
> [MotherDuck - Analyze SQLite in DuckDB](https://motherduck.com/blog/analyze-sqlite-databases-duckdb/) -- practical guide

### Concurrency

DuckDB supports multiple concurrent readers but only a single writer at a time (similar to SQLite). Write transactions are serialized.

### Backup

Single file, similar to SQLite. Same backup strategies apply.

### Limitations

- Optimized for analytics, not transactional workloads. INSERT/UPDATE/DELETE of individual rows is slower than SQLite.
- Larger binary size and memory footprint than SQLite.
- The performance advantage is irrelevant at fleet-manager's data scale.
- No built-in full-text search comparable to FTS5.
- No native vector search.
- Ecosystem is younger than SQLite's, though maturing rapidly (v1.0 in mid-2024, v1.3.2 current).

---

## LanceDB

### Architecture

Embedded vector database built on the Lance columnar format (Apache Arrow-based). Designed for storing and querying high-dimensional vector embeddings alongside structured data. Supports similarity search (L2, cosine, dot product), full-text search, and hybrid queries combining both.

> [LanceDB documentation](https://docs.lancedb.com) -- official docs
> [LanceDB on GitHub](https://github.com/lancedb/lancedb) -- 13k+ stars

### Go Support

A Go SDK exists at `github.com/lancedb/lancedb-go/pkg/lancedb`, published September 2025. It uses CGO bindings to the Rust core library.

Critically, the Go SDK was **not included** in the Lance SDK 1.0.0 release (December 2025). The 1.0.0 milestone covers Python, JavaScript/TypeScript, Java, and Rust. The Go SDK appears to be community-maintained rather than a tier-1 supported binding.

> [LanceDB Go package](https://pkg.go.dev/github.com/lancedb/lancedb-go/pkg/lancedb) -- Go bindings
> [Lance SDK 1.0.0 announcement](https://lancedb.com/blog/announcing-lance-sdk/) -- does not list Go

### Use Case Fit

LanceDB's primary value is vector similarity search -- "find ships similar to X" based on embedding vectors. This requires:

1. An embedding model to convert ship descriptions/attributes into vectors
2. Storage of those vectors alongside ship data
3. Query-time similarity computation

For fleet-manager, this would enable queries like "find ships similar to the Carrack" based on attributes (size, crew, cargo, role). However, this requires generating and maintaining embeddings, adding complexity.

### Limitations

- Go SDK is not at 1.0 parity with Python/JS/Rust SDKs.
- Requires an embedding model (adds a dependency and compute cost).
- The dataset is small enough that attribute-based filtering in SQL achieves similar results without embeddings.
- Not a general-purpose relational database -- cannot replace SQLite for transactional data.
- Would need to run alongside SQLite, not instead of it.

---

## Meilisearch

### Architecture

Standalone search engine written in Rust. Provides typo-tolerant, instant search with faceted filtering, geosearch, and multi-language support. Uses a memory-mapped database (LMDB) on disk, with the OS loading relevant portions into RAM.

**Not embedded** -- runs as a separate process/container. Communicates over HTTP REST API.

> [Meilisearch documentation](https://www.meilisearch.com/docs/faq) -- FAQ and architecture
> [Meilisearch vs Typesense](https://www.meilisearch.com/blog/meilisearch-vs-typesense) -- official comparison

### Deployment Model

For fleet-manager on Kubernetes, Meilisearch would run as a sidecar container or a separate deployment. It needs its own persistent volume for index storage.

### Resource Usage

For small datasets (~1,000 records), Meilisearch needs 512 MB to 2 GB of RAM depending on document size. The recommendation is 10x disk space relative to dataset size. The default indexing memory limit is 2/3 of available RAM.

> [Meilisearch indexing and performance](https://www.meilisearch.com/docs/learn/advanced/indexing) -- resource guidance

### Performance

Search results return in under 50 ms with built-in typo tolerance. For fleet-manager's ship database (~600 records), search would be effectively instant.

Indexing is asynchronous -- documents are queued and indexed in the background.

### Go Integration

Go clients exist but communication is via HTTP. The application would need to sync data from SQLite to Meilisearch after imports and keep the two in sync.

### Licensing

MIT license. No commercial restrictions.

### Limitations

- **Not embedded** -- adds operational complexity (separate container, health checks, data sync).
- **Data duplication** -- ship data lives in both SQLite and Meilisearch.
- **Sync complexity** -- after every import, data must be pushed to Meilisearch.
- **Not a database** -- cannot replace SQLite. It is a search index that sits alongside a database.
- For ~600 ships, SQLite FTS5 provides comparable search capability with zero additional infrastructure.

---

## Typesense

### Architecture

Standalone search engine written in C++. Stores its entire index in RAM for maximum speed. Typo-tolerant search, faceted filtering, geosearch, and vector search (via built-in ML models or pre-computed embeddings).

**Not embedded** -- runs as a separate process/container. Communicates over HTTP REST API.

> [Typesense system requirements](https://typesense.org/docs/guide/system-requirements.html) -- resource documentation
> [Typesense comparison with alternatives](https://typesense.org/docs/overview/comparison-with-alternatives.html) -- positioning

### Resource Usage

Typesense stores its entire index in RAM. For the dataset size in question, this is negligible. However, if semantic/hybrid search with built-in ML models (S-BERT, E-5) is used, models alone require 2-6 GB of RAM. Vector storage is calculated as `7 bytes * dimensions * records`.

For fleet-manager without ML models, a Typesense sidecar would use minimal RAM. With ML models, the resource cost is disproportionate to the dataset.

### Go Integration

Official Go client at `github.com/typesense/typesense-go/v4/typesense`. Communication via HTTP.

> [typesense-go on GitHub](https://github.com/typesense/typesense-go) -- official Go client

### Licensing

GPL-3.0. More restrictive than Meilisearch's MIT license. Requires any modifications to Typesense itself to be open-sourced. Using it as a service (unmodified) alongside your application does not trigger GPL obligations.

### Limitations

- **Not embedded** -- same operational overhead as Meilisearch.
- **RAM-bound index** -- dataset size limited by available memory (not an issue at this scale, but a design constraint).
- **GPL-3.0 license** -- more restrictive than MIT.
- **Sidecar complexity** -- data directory locking issues reported when multiple instances access the same data directory.
- Same data duplication and sync issues as Meilisearch.

---

## Comparison

### Feature Matrix

| Dimension | SQLite | DuckDB | LanceDB | Meilisearch | Typesense |
|-----------|--------|--------|---------|-------------|-----------|
| **Type** | Embedded OLTP | Embedded OLAP | Embedded vector DB | Standalone search | Standalone search |
| **Deployment** | In-process | In-process | In-process | Separate container | Separate container |
| **Go support** | Mature (CGO) | Mature (CGO) | Pre-1.0 (CGO) | HTTP client | HTTP client |
| **Storage** | Row-oriented, single file | Columnar, single file | Lance format, directory | LMDB, directory | RAM + disk, directory |
| **Concurrency** | Multi-reader, single-writer | Multi-reader, single-writer | Multi-reader, single-writer | Multi-reader, async indexer | Multi-reader, async indexer |
| **Full-text search** | FTS5 (built-in) | None built-in | Basic FTS | Typo-tolerant, instant | Typo-tolerant, instant |
| **Vector search** | No | No | Native | No (basic) | Via ML models |
| **Transactional** | Yes (ACID) | Limited | No | No | No |
| **Backup** | File copy / Litestream | File copy | Directory copy | Volume snapshot | Volume snapshot |
| **LLM access** | MCP server exists | Can attach SQLite files | No established pattern | HTTP API | HTTP API |
| **License** | Public domain | MIT | Apache 2.0 | MIT | GPL-3.0 |

### Fit for Fleet-Manager Workload

| Dimension | SQLite | DuckDB | LanceDB | Meilisearch | Typesense |
|-----------|--------|--------|---------|-------------|-----------|
| **Read-heavy web serving** | Excellent | Overkill | Not designed for this | Excellent (search only) | Excellent (search only) |
| **Bulk import writes** | Good (with transactions) | Good | N/A | N/A (index push) | N/A (index push) |
| **Fleet analysis queries** | Adequate | Excellent | N/A | N/A | N/A |
| **Ship search/browse** | Good (FTS5) | Poor | Good (similarity) | Excellent | Excellent |
| **Data scale fit (<50 MB)** | Ideal | Overkill | Overkill | Overkill | Overkill |
| **Operational complexity** | Zero | Zero | Low | Medium | Medium |
| **Additional infrastructure** | None | None | None | Container + PV | Container + PV |

### Concurrency Under Fleet-Manager's Workload

| Scenario | SQLite | DuckDB | Meilisearch | Typesense |
|----------|--------|--------|-------------|-----------|
| Web read during sync write | No blocking (WAL) | No blocking | N/A (separate service) | N/A (separate service) |
| Two simultaneous imports | Serialized (busy_timeout) | Serialized | Queued async | Queued async |
| LLM query during web use | No blocking (WAL) | No blocking | No blocking | No blocking |

---

## Embedded vs Client-Server

### When Embedded Makes Sense

- Single-user or single-process applications
- Small datasets (under 1 GB)
- Deployment simplicity is valued (no separate services to manage)
- Backup is "copy a file"
- The application is the only consumer of the data
- Kubernetes single-replica StatefulSet pattern

Fleet-manager matches all of these criteria.

### When Client-Server Makes Sense

- Multiple applications or services need the same data
- Multi-user write concurrency is required
- Dataset exceeds available RAM/single-node capacity
- Operational teams exist to manage database infrastructure
- Need for replication, sharding, or high availability

Fleet-manager does not match any of these criteria.

### LLM Access Patterns

For LLM tools (Claude Code, Claude Desktop) to access fleet-manager data:

| Pattern | How it works | Complexity |
|---------|-------------|------------|
| SQLite MCP server | Claude reads the .db file directly via MCP server | Low -- file path config only |
| HTTP API | Claude calls fleet-manager's existing REST API via MCP | Low -- URL config only |
| DuckDB overlay | DuckDB attaches the SQLite file, Claude queries via DuckDB | Medium -- requires DuckDB MCP or tool |
| Search engine API | Claude queries Meilisearch/Typesense HTTP API | Medium -- separate service must be running |

The simplest path is the existing REST API (already built) or a SQLite MCP server pointing at the database file.

---

## Gaps

- **SQLite FTS5 vs Meilisearch/Typesense quality**: No direct comparison found for typo tolerance quality on small datasets. FTS5 handles prefix matching but its typo tolerance is limited compared to dedicated search engines.
- **DuckDB Go driver stability at scale**: The official move to `duckdb/duckdb-go` is recent (v2.5.0). Long-term stability data is limited.
- **LanceDB Go SDK roadmap**: No public roadmap found for when Go will reach 1.0 parity with Python/JS.
- **Litestream + WAL2 interaction**: SQLite's experimental WAL2 mode (concurrent writers) has unknown compatibility with Litestream.
- **Real-world memory usage of Meilisearch/Typesense on homelab hardware**: Actual resource consumption on constrained hardware (e.g., cluster nodes with limited RAM) was not benchmarked.
- **CGO-free alternatives**: `modernc.org/sqlite` provides a pure-Go SQLite implementation (no CGO needed) but performance comparisons against `mattn/go-sqlite3` at this data scale were not found.

---

## Summary

| Technology | Primary strength | Fleet-manager fit |
|------------|-----------------|-------------------|
| SQLite | Zero-ops embedded OLTP, universal tooling, file-based backup | Matches the workload exactly |
| DuckDB | Columnar analytics at scale | Adds value only if analytical queries become complex or data grows significantly |
| LanceDB | Vector similarity search | Adds value only if semantic ship matching via embeddings is desired; Go SDK is immature |
| Meilisearch | Typo-tolerant instant search | Adds value only if search UX needs to exceed what FTS5 provides; adds operational cost |
| Typesense | Fast in-memory search with optional ML | Similar to Meilisearch with higher resource cost for ML features; GPL license |

These technologies are not mutually exclusive. DuckDB can read SQLite files directly. Meilisearch/Typesense can index data from SQLite. LanceDB can run alongside SQLite for vector queries. The question is whether the added capability justifies the added complexity for this specific workload.
