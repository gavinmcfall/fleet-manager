---
description: Database selection research for Star Citizen Wiki API replication with nightly sync
tags: [database, architecture, performance, sqlite, postgresql, wiki-sync]
audience: { human: 70, agent: 30 }
purpose: { research: 90, design: 10 }
---

# Database Strategy Research

Research for selecting the database technology for Fleet Manager when replicating the majority of Star Citizen Wiki API data with nightly sync operations.

*Research date: 2026-02-14*

## Context

**Decision**: What database should Fleet Manager use when expanding to store comprehensive Star Citizen Wiki API data?

**Current state**:
- Supports SQLite (default) or PostgreSQL via dual-driver abstraction
- ~16 tables: ships, vehicles, hangar imports, sync metadata, settings, AI analyses
- Dataset: ~800 FleetYards ships, ~38 user vehicles, small auxiliary tables
- Current storage: structured columns + `raw_json TEXT` / `data TEXT` for API payloads
- Deployment: Single-replica StatefulSet on homelab Kubernetes (Talos, Flux, BJW-S app-template)
- Build: `CGO_ENABLED=1` required for go-sqlite3

**New requirements**:
- Replicate "vast majority" of SC Wiki API data (ships, components, celestial objects, galactapedia entries, items)
- Nightly sync operations (bulk writes)
- Speed critical for: web page loads (sub-100ms goal), LLM data access (AI analysis feature)
- Self-hosted primary use case, potential future cloud deployment

**Key workload characteristics**:
- Read-heavy after batch writes (imports are clean-slate DELETE+INSERT)
- Data immutable between syncs (ideal for caching)
- Small dataset today, will grow to thousands of records across wiki tables
- Complex nested JSON (e.g., Carrack has 500-800+ fields across 8-10 nesting levels)
- Relationship queries: 1-2 hop JOINs (vehicles→ships, vehicles→hangar_imports)

## Relational Databases (Current Approach)

Three options compared across performance, deployment, JSON handling, query speed, LLM integration, backup, and schema migration.

### SQLite (Current Default)

**Performance**: 70,000 reads/sec in WAL mode. Sub-microsecond latency for simple queries (no network hop). Concurrent reads during writes.

> [SQLite Appropriate Uses](https://www.sqlite.org/whentouse.html) — Official guidance on workload fit

**JSON handling**: JSONB support added in v3.45.0 (March 2024), but O(N) key lookup vs PostgreSQL's O(1). No GIN indexing on documents.

> [SQLite JSON1 Extension](https://www.sqlite.org/json1.html) — Official docs on JSONB

**Deployment**: Single file. Zero external dependencies. Backup via file copy or Litestream sidecar.

> [Litestream](https://litestream.io/) — Continuous SQLite replication to S3-compatible storage

**Limitations**:
- No ALTER COLUMN for type changes (schema evolution harder)
- Weaker JSONB than PostgreSQL
- No built-in replication (Litestream or LiteFS required)

**Field sentiment**: SQLite is seeing a renaissance in 2025-2026 with libSQL, Turso, and edge computing patterns. "SQLite is eating the cloud" is a common refrain.

> [SQLite Eating the Cloud in 2025](https://debugg.ai/resources/sqlite-eating-the-cloud-2025-edge-databases-replication-patterns-ditch-server) — Industry analysis

### PostgreSQL

**Performance**: Low single-digit milliseconds for network round-trip queries. For fleet-manager's dataset size, easily achieves sub-100ms web responses.

**JSON handling**: JSONB with O(1) key lookup, GIN indexing, and extensive operators (`->`, `->>`, `@>`, `?`). Best-in-class for querying into JSON documents. **Performance cliff**: TOAST threshold at ~2KB causes 2-10x slowdown for larger documents. Wiki API ship documents (500-800 fields) will exceed this.

> [PostgreSQL JSONB Documentation](https://www.postgresql.org/docs/current/datatype-json.html) — Official JSON capabilities

**Deployment**: Requires separate database pod, CloudNativePG operator (CNCF Sandbox project, leading Postgres K8s operator), PVC management, credentials. More operational overhead than SQLite for single-user app.

> [CloudNativePG](https://cloudnative-pg.io/) — PostgreSQL operator for Kubernetes

**Extensions ecosystem**: Richest extension ecosystem of any database. Relevant for this use case:
- **pgvector** / **pgvectorscale**: Ship similarity search via vector embeddings
- **pg_trgm**: Fuzzy/typo-tolerant matching (replaces cascading LIKE queries)
- **pg_search (ParadeDB)** or **pg_textsearch**: BM25 full-text search (Elasticsearch-quality)
- **TimescaleDB**: Ship stat versioning across game patches
- **Apache AGE**: Cypher graph queries as PostgreSQL extension

> [ParadeDB pg_search](https://www.paradedb.com/blog/introducing-search) — BM25 in PostgreSQL
> [pgvector GitHub](https://github.com/pgvector/pgvector) — Vector similarity search

**Maximalist thesis**: "It's 2026, Just Use Postgres" argues a single PostgreSQL instance with extensions replaces what used to require 5-6 specialized databases (MongoDB for documents, Pinecone for vectors, Elasticsearch for search, Neo4j for graphs).

> [It's 2026, Just Use Postgres](https://www.tigerdata.com/blog/its-2026-just-use-postgres) — Tiger Data analysis

**Limitations**:
- Network latency (vs embedded SQLite)
- Operational complexity for single-user self-hosted app
- JSONB performance degrades on large documents

### MySQL/MariaDB

**Performance**: Comparable to PostgreSQL for this workload.

**JSON handling**: Binary JSON storage but requires generated columns for indexing (less ergonomic than PostgreSQL JSONB).

**Deployment**: Similar operational overhead to PostgreSQL (separate pod, operator, PVC).

**Limitations**:
- Non-transactional DDL (schema migrations riskier)
- Weaker JSON querying vs PostgreSQL
- Less relevant extension ecosystem for this use case

**Field sentiment**: No compelling reason to choose MySQL over PostgreSQL for new projects in 2026 unless organizational MySQL expertise exists.

## Document Databases

Four options researched: MongoDB, CouchDB, RavenDB, and PostgreSQL JSONB as baseline.

### MongoDB

**Performance**: BSON shows flat performance curves regardless of document size. Field-level updates without full document rewrites (addresses PostgreSQL's TOAST cliff). Vendor benchmarks claim 2-3x faster document reads vs PostgreSQL JSONB at scale.

> [MongoDB Performance Best Practices](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/) — Official guidance

**Features**: Vector search and full-text search available in Community Edition (self-hosted) as of September 2025. Official Go driver (v2.4) actively maintained.

> [MongoDB Go Driver](https://github.com/mongodb/mongo-go-driver) — Official client

**Deployment**: 4GB RAM minimum. Requires separate pod, Kubernetes operator (Community Operator lacks backup/restore features), PVC.

**Licensing**: Server Side Public License (SSPL). Community Edition is free but SSPL is incompatible with some SaaS deployment models.

**Limitations**:
- Higher resource requirements than SQLite/PostgreSQL
- Another language to learn (MongoDB Query Language vs SQL)
- Community Operator missing critical backup features

**Field sentiment**: Widely used in production. Well-understood operational patterns. The SSPL license change (2018) remains controversial.

### CouchDB

**Performance**: No specific benchmarks found for large nested documents.

**Deployment**: Lightest operationally — official Apache Helm chart, Apache 2.0 license, low resource requirements.

**Limitations**:
- No aggregation pipelines (unlike MongoDB)
- No vector search
- Go driver is community-maintained (no corporate backing)

**Field sentiment**: Smaller ecosystem than MongoDB. Less common in new projects.

### RavenDB

**Performance**: Vendor claims strong performance, but primary ecosystem is .NET/C#.

**Limitations**:
- Go client is "preview" status (not production-ready)
- Kubernetes deployment requires manual DNS/LB configuration
- Free tier has resource caps (3 cores, 6GB RAM, annual renewal)

**Assessment**: Poor fit for Go-based self-hosted project.

### PostgreSQL JSONB (Baseline)

See Relational Databases section above. The TOAST threshold (2KB) is the critical limitation for large wiki documents.

**Hybrid pattern**: Current fleet-manager already uses scalar columns for queries + `raw_json TEXT` for full storage. This partially mitigates JSONB performance issues by not querying into the full document.

## Embedded Databases

Five options researched: SQLite (current), DuckDB, LanceDB, Meilisearch, Typesense.

### SQLite (Current)

See Relational Databases section. WAL mode provides 70,000 reads/sec, concurrent reads during writes, FTS5 for full-text search.

**MCP integration**: SQLite MCP server exists for direct LLM access to database.

> [SQLite MCP Server](https://github.com/designcomputer/sqlite_mcp_server) — Model Context Protocol server

**Replication options**:
- **libSQL**: Turso's SQLite fork with server mode, replication, vector search, WASM support
- **LiteFS**: Distributed filesystem intercepting SQLite writes, shipping WAL frames to replicas
- **Litestream**: Continuous replication to S3-compatible storage (MinIO in cluster)

> [libSQL GitHub](https://github.com/tursodatabase/libsql) — SQLite fork with replication
> [LiteFS Docs](https://fly.io/docs/litefs/) — Distributed filesystem for SQLite

### DuckDB

**Purpose**: Columnar embedded OLAP (analytics), not OLTP (transactions).

**Performance**: 10-100x faster than SQLite for analytical queries, but advantage materializes at thousands-to-millions of rows. Fleet-manager's ~600 ships do not benefit.

**Unique capability**: Can attach and query SQLite files directly via `sqlite` extension, making it a potential analytical overlay without migration.

> [DuckDB Official](https://duckdb.org/) — Columnar database
> [DuckDB Go Bindings](https://github.com/duckdb/duckdb-go) — CGO-based driver

**Use case fit**: Current fleet analysis (38 ships, few hundred rows) does not need columnar-vectorized execution. Becomes interesting if aggregating across multiple users' fleets or tracking historical stat changes.

### LanceDB

**Purpose**: Embedded vector database for similarity search.

**Limitations**: Go SDK published September 2025 but not included in Lance SDK 1.0.0 (December 2025). Pre-production for Go applications.

> [LanceDB](https://lancedb.com/) — Vector database

**Use case fit**: "Find ships similar to the Carrack" based on embedded stat vectors. For 800 ships, brute-force cosine similarity in Go would take microseconds. Vector database only justified at scale or for semantic embeddings from descriptions.

### Meilisearch

**Purpose**: Standalone search engine (not embedded). Runs as separate container, communicates via HTTP.

**Performance**: Sub-50ms search. Typo tolerance, faceting, filtering built-in. Rust-based, MIT license.

> [Meilisearch](https://www.meilisearch.com/) — Official site

**Pattern**: Primary DB (SQLite/Postgres) is source of truth. Push data to Meilisearch on sync. Reads go to search engine.

**Use case fit**: ShipDB page (800+ ships) with instant-as-you-type search, faceted filtering by manufacturer/role/size. Value increases if indexing galactapedia entries, comm-links, items, celestial objects.

**Trade-off**: Another service to deploy. Data eventually consistent (but nightly sync already means data is static between syncs).

### Typesense

**Purpose**: Similar to Meilisearch. C++-based, GPL-3.0 licensed.

**Performance**: Sub-50ms search. Stores entire index in RAM.

**Trade-off**: Higher resource requirements (RAM-resident). GPL-3.0 may be concern for future distribution.

## Graph Databases

Six options researched: Neo4j, ArangoDB, Dgraph, Apache AGE (PostgreSQL extension), FalkorDB (Redis module), PostgreSQL recursive CTEs.

### Current Workload Analysis

**Existing queries**: All 1-2 hop JOINs (vehicles→ships, vehicles→hangar_imports). Deepest query is `GetVehiclesWithInsurance` with 2-way LEFT JOIN.

**Graph value proposition threshold**: Research shows graph databases provide significant advantages at **4+ relationship hops**. Benchmarks show 1000x speedups for arbitrary path queries at that depth. For 1-2 hop queries, relational databases are typically faster.

> [Graph Databases vs Relational](https://neo4j.com/blog/why-graph-databases-are-the-future/) — Neo4j perspective
> [Apache AGE Benchmarks](https://age.apache.org/age-manual/master/intro/overview.html) — Graph vs relational performance

### When Graph Databases Become Relevant

- **CCU chain/upgrade path data**: Pathfinding across variable-depth upgrade chains (Ship A → Ship B with minimum cost)
- **Component loadout relationships**: Cross-ship comparison spanning 3+ hops (Ship → Hardpoint → Item → Component → Manufacturer)
- **Fleet relationship visualization**: Arbitrary-depth traversal (loaner chains, organizational hierarchies)

### Neo4j

**Ecosystem**: Market leader. Cypher query language. Strongest LLM/GraphRAG integration (native vector search, LangChain, Knowledge Graph Builder). Strong Go driver (v6).

**Deployment**: Community Edition is GPLv3, single-node only. Requires JVM, ~512MB-1GB minimum. Official Helm chart available.

**Trade-off**: JVM overhead. GPL license. Graph-specific query language learning curve.

> [Neo4j](https://neo4j.com/) — Official site

### Apache AGE (PostgreSQL Extension)

**Approach**: Adds openCypher support to PostgreSQL. Apache 2.0 license. Zero additional infrastructure.

**Performance**: On small datasets, recursive CTEs actually outperform AGE Cypher queries (~0.8ms vs ~1.5ms in one benchmark).

> [Apache AGE](https://age.apache.org/) — PostgreSQL graph extension

**Trade-off**: Go driver ecosystem immature. For current fleet-manager workload, recursive CTEs or Go code likely sufficient.

### Assessment

Graph databases are **overkill** for current fleet-manager workload. Relevant **only if** expanding to CCU chain pathfinding, deep component relationship modeling, or arbitrary-depth fleet hierarchies.

## Comparison Across Key Dimensions

### Performance (Web Page Loads)

| Database | Typical Query Latency | Dataset Size Sensitivity | Assessment for <100ms Goal |
|----------|----------------------|--------------------------|---------------------------|
| SQLite (embedded) | Sub-microsecond (in-process) | Low | ✅ Trivially achieves goal |
| PostgreSQL (network) | 1-5ms (network round-trip) | Low | ✅ Easily achieves goal |
| MongoDB | 2-5ms | Medium (scales better with large docs) | ✅ Achieves goal |
| DuckDB | 1-10ms analytical | High (optimized for large datasets) | ✅ Achieves goal, overkill for OLTP |
| Neo4j | 1-20ms | High (optimized for deep traversal) | ✅ Achieves goal, overkill for current queries |

**Verdict**: All options meet sub-100ms goal for current dataset. Performance is **not a differentiator** at this scale.

### Performance (LLM Data Access)

| Pattern | Database Impact | Bottleneck |
|---------|----------------|------------|
| API endpoints (current) | Database query time 1-10ms | LLM token processing (seconds to minutes) |
| MCP servers | Direct DB access, <1ms latency | LLM token processing |
| Database dump | SQLite: single file copy; Postgres: pg_dump | LLM context window size |

**Verdict**: Database choice does **not affect** LLM access speed. Token processing is the bottleneck, not query time.

> [Model Context Protocol](https://www.anthropic.com/news/model-context-protocol) — Anthropic MCP overview

### Deployment Complexity

| Database | Infrastructure | Operational Overhead | Backup Strategy |
|----------|---------------|---------------------|-----------------|
| SQLite | App pod + PVC | Minimal (single file) | File copy or Litestream |
| PostgreSQL | DB pod + operator + PVC + credentials | Medium (CloudNativePG automates most) | pg_dump or WAL archiving (PITR) |
| MongoDB | DB pod + operator + PVC | Medium-High (4GB RAM min, operator lacks backup) | mongodump or replica sets |
| Meilisearch | Search pod + PVC | Medium (another service) | Rebuild from primary DB |
| Neo4j | DB pod + PVC | Medium (JVM, ~1GB RAM) | neo4j-admin dump |

**Verdict**: SQLite has **lowest operational overhead** for single-user self-hosted. PostgreSQL justified when extensions (pgvector, pg_trgm, pg_search) provide compelling features.

### JSON Handling

| Database | Indexing | Query Ergonomics | Large Document Performance |
|----------|----------|-----------------|---------------------------|
| PostgreSQL JSONB | GIN indexes, O(1) key lookup | Excellent (`->`, `->>`, `@>`) | ⚠️ TOAST cliff at 2KB (2-10x slower) |
| MongoDB BSON | Compound indexes | Good (dot notation) | ✅ Flat performance curve |
| SQLite JSONB | Limited (FTS5 for search) | Fair (O(N) key lookup) | ⚠️ No optimization for large docs |
| Hybrid (scalar + TEXT) | Index scalars, store JSON as TEXT | Manual extraction | ✅ No JSONB penalties |

**Verdict**: For 500-800 field wiki documents, **MongoDB** has best large-document handling. **Hybrid pattern** (current approach) avoids JSONB penalties by not querying into full JSON blobs.

### Schema Evolution

| Database | ALTER TABLE | Migration Tooling | Risk |
|----------|------------|------------------|------|
| PostgreSQL | Full support, transactional DDL | Excellent (Goose, Atlas, golang-migrate) | Low |
| MySQL | Full support, non-transactional DDL | Good (same tools) | Medium (rollback harder) |
| SQLite | No ALTER COLUMN (type changes) | Fair (requires table recreation) | Medium |
| MongoDB | Schemaless | N/A (application-level validation) | Low (flexible) to High (no enforcement) |

**Verdict**: PostgreSQL has **best schema migration story**. MongoDB's schemaless nature is double-edged (flexibility vs consistency).

### Future Cloud Path

| Database | Self-Hosted Today | Cloud Migration Target | Effort |
|----------|------------------|----------------------|--------|
| SQLite | Single file | Cloudflare D1 (SQLite-compatible) or Turso | Low (same SQL dialect) |
| PostgreSQL | CloudNativePG | AWS RDS, Neon, Supabase | Low (standard Postgres) |
| MongoDB | Community Operator | MongoDB Atlas | Low (official path) |
| Meilisearch | Self-hosted binary | Meilisearch Cloud | Low (official path) |

**Verdict**: Both SQLite→D1 and PostgreSQL→managed-Postgres have **clear cloud migration paths**.

> [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/) — SQLite-compatible edge database

## Approaches Not Initially Considered

Research uncovered several patterns not in the initial brief:

### Hybrid Postgres-as-Everything

PostgreSQL + extensions as a **single database replacing multiple specialized systems**:
- **pgvector** for ship similarity search (replaces dedicated vector DB)
- **pg_trgm** for fuzzy ship name matching (replaces cascading LIKE queries)
- **ParadeDB pg_search** for Elasticsearch-quality search (replaces Meilisearch)
- **TimescaleDB** for ship stat versioning across game patches
- **Apache AGE** for graph queries (replaces Neo4j)

**Trade-off**: One database, one backup, one query language. But drops SQLite portability and increases PostgreSQL dependency.

> [Tiger Data Blog](https://www.tigerdata.com/blog/) — Postgres extension ecosystem analysis

### SQLite Replication Ecosystem

Modern SQLite replication patterns addressing "no built-in replication" limitation:
- **libSQL**: Turso's fork with server mode, embedded replicas, vector search
- **LiteFS**: Distributed filesystem for SQLite with replica sync
- **Litestream**: Continuous S3 replication

**Trade-off**: Keeps single-binary simplicity while adding replication. But betting on Turso's fork longevity (libSQL) or filesystem-layer complexity (LiteFS).

### Caching Layers

**Pattern**: Go in-memory cache (sync.Map or ristretto) since data is immutable between syncs.

**Justification**: Current workload is read-heavy after clean-slate imports. First request hits DB, result cached until next import. Zero staleness risk.

**Trade-off**: For ~800 ships loading in single-digit milliseconds, caching adds complexity for negligible latency improvement. Matters only if: (a) many concurrent users, (b) sub-millisecond LLM queries, or (c) network round-trip to PostgreSQL becomes bottleneck.

> [ristretto](https://github.com/dgraph-io/ristretto) — High-performance Go cache

### LLM Integration Patterns

Emerging patterns beyond "send data to LLM, store result":

1. **Text-to-SQL / NL2SQL**: Expose database via MCP, letting users ask natural language questions. Schema-aware prompting enables accurate SQL generation.
2. **GraphRAG**: Build knowledge graph, retrieve subgraphs as context instead of dumping full fleet.
3. **Embedding-augmented queries**: Store ship description embeddings alongside structured data, retrieve by semantic similarity.

**Assessment**: Schema-aware prompting (include `CLAUDE.md` schema docs in prompts) is **cheapest, most effective** LLM integration. Requires no database changes.

> [Text-to-SQL LLM Accuracy 2026](https://research.aimultiple.com/text-to-sql/) — Industry analysis
> [GraphRAG with Neo4j](https://neo4j.com/blog/genai/advanced-rag-techniques/) — Graph-based retrieval

### Search-Optimized Sidecar Pattern

**Pattern**: Primary DB (SQLite/Postgres) as source of truth. Meilisearch/Typesense as read-only search index, populated on sync.

**Use case**: ShipDB page with instant-as-you-type search, faceted filtering, typo tolerance. No impact on primary DB under load.

**Assessment**: Justified if expanding to galactapedia entries, comm-links, items, celestial objects (thousands of searchable records). For 800 ships alone, SQLite FTS5 or PostgreSQL full-text search likely sufficient.

### DuckDB as Analytics Overlay

**Pattern**: Keep SQLite/Postgres for OLTP. Attach DuckDB for analytical queries without data import.

**Use case**: Replace Go-code fleet analysis with SQL. Aggregate across users' fleets. Export to Parquet for LLM analysis.

**Assessment**: Overkill for current 38-ship single-user workload. Becomes interesting for multi-user aggregation or historical stat tracking.

## Star Citizen Community Precedent

| Tool | Database | Rationale |
|------|----------|-----------|
| **FleetYards** | PostgreSQL + Redis | Standard Rails pattern (not architecture decision) |
| **Star Citizen Wiki** | MySQL/MariaDB | Standard MediaWiki default |
| **starcitizen-api.com** | Not documented | N/A |

**Assessment**: No community tool uses graph, vector, or multi-model databases. Ecosystem is standard web-app stacks (Rails+Postgres, Laravel+MySQL). No proven precedent to draw from, but also no proven failures.

> [FleetYards GitHub](https://github.com/fleetyards/fleetyards) — Ruby on Rails + PostgreSQL
> [Star Citizen Wiki Tech Stack](https://stackshare.io/star-citizen-wiki/starcitizen-tools) — PHP + MediaWiki

## Gaps in Research

1. **No benchmark against fleet-manager's specific query patterns**: All performance data is from vendor benchmarks or generic workloads, not tested against actual wiki API document structure (500-800 fields, 8-10 nesting levels).

2. **CGO cross-compilation impact not assessed**: Both SQLite and DuckDB require CGO. Building for multiple platforms (amd64, arm64) and operating systems not researched.

3. **Litestream production reliability sparse**: Community reports exist but no large-scale production case studies found for multi-year deployments.

4. **libSQL longevity unknown**: Turso's SQLite fork is young (2023). Long-term maintenance commitment unclear if Turso pivots or is acquired.

5. **Large JSON document benchmarks missing**: No independent test of PostgreSQL JSONB vs MongoDB BSON vs hybrid pattern on 500-800 field documents.

6. **Kubernetes resource usage on homelab hardware**: All resource requirements (MongoDB 4GB, Neo4j 1GB) are from vendor docs, not tested on Talos/Flux homelab setup.

7. **MCP server maturity**: Model Context Protocol is new (2024). Production reliability of SQLite/PostgreSQL MCP servers for LLM integration unknown.

8. **FleetYards API rate limits**: If syncing from FleetYards, their API rate limits not documented. May affect sync strategy.

## Summary Tables

### By Primary Decision Factor

If you value **simplicity above all**:
- SQLite (current) with Litestream for backups

If you value **feature richness**:
- PostgreSQL + pgvector + pg_trgm + ParadeDB pg_search

If you value **JSON performance**:
- MongoDB or hybrid pattern (scalar columns + raw JSON)

If you value **future extensibility**:
- PostgreSQL (extension ecosystem) or MongoDB (flexible schema)

If you value **cloud migration path**:
- SQLite → Cloudflare D1 or PostgreSQL → managed Postgres

### By Workload Characteristic

| Your Workload Is... | Best Fit | Why |
|---------------------|----------|-----|
| Read-heavy, single-user, self-hosted | SQLite | Embedded, zero ops, file-based backup |
| JSON-heavy, large nested docs | MongoDB or hybrid pattern | Avoids JSONB TOAST penalties |
| Complex relationships, deep traversal | PostgreSQL recursive CTEs or Neo4j | Only if 4+ hop queries needed |
| Search-heavy (full-text, faceted) | PostgreSQL + pg_search or Meilisearch | BM25 quality search |
| Requires vector similarity | PostgreSQL + pgvector or LanceDB | Similarity search on embeddings |
| Will expand to multi-user | PostgreSQL | Concurrency, extensions, operational maturity |

---

*Research conducted 2026-02-14. Detailed findings in companion documents: relational-database-comparison.md, document-databases.md, embedded-database-research.md, graph-databases.md.*
