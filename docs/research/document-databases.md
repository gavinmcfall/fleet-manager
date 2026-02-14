---
description: Research into document databases (MongoDB, CouchDB, RavenDB) and PostgreSQL JSONB for storing Star Citizen JSON-heavy ship/component data
tags: [database, document-db, mongodb, couchdb, ravendb, postgresql, jsonb, research]
audience: { human: 70, agent: 30 }
purpose: { research: 90, reference: 10 }
---

# Document Databases for Fleet Manager

Research for whether to adopt a document database for storing Star Citizen wiki/API data (ship specs, component trees, loadouts, wiki metadata).

*Research date: 2026-02-14*

## Context

The fleet manager currently uses SQLite (default) or PostgreSQL with a flat relational schema. The `Ship` model has ~25 scalar columns. The `RawJSON` field stores the full FleetYards response but is not queryable.

Two new data sources are under consideration:

- **Star Citizen Wiki API** returns ship documents with **500-800+ fields** and **8-10 levels of nesting** (hardpoints containing items containing ports containing children containing weapons containing ammunition containing damage falloffs).
- **FleetYards API** returns ship documents with **~180 fields** and **~5 levels of nesting**.

The question is whether a document database would handle this nested JSON data better than the current relational approach, given the constraints: self-hosted Kubernetes deployment, nightly sync from external APIs, web page load speed, and future LLM data access.

---

## MongoDB

### Facts and Capabilities

**Performance.** MongoDB 8.0 is 36% faster for read workloads and 32% faster for mixed read/write workloads compared to 7.0. It claims 1 million+ reads/sec on commodity hardware for document workloads. BSON (binary JSON) storage enables field-level updates without rewriting the entire document, resulting in lower I/O amplification than systems that treat documents as monolithic values.

> [MongoDB 8.0 Performance Blog](https://www.mongodb.com/company/blog/engineering/mongodb-8-0-improving-performance-avoiding-regressions) -- MongoDB's own benchmark claims for 8.0 vs 7.0

**Large document handling.** BSON outperforms both JSON and JSONB storage with "a very flat curve across all payloads" as document size grows. This matters for the Wiki API data where a single Carrack document is 500-800+ fields.

> [Evaluation of Update-Heavy Workloads](https://www.mongodb.com/company/blog/technical/evaluation-update-heavy-workloads-postgresql-jsonb-and-mongodb-bson) -- MongoDB-authored benchmark comparing BSON vs JSONB for updates (note source bias)

**Aggregation pipelines.** Replace SQL joins with pipeline stages. Real-world reports of "200-line SQL queries becoming 20-line pipelines" with "query times dropping from seconds to milliseconds." Performance degrades with complexity when missing indexes, over-using `$unwind`/`$lookup`, or with poor stage ordering. MongoDB 8.0 includes a slot-based execution engine with improved performance and lower CPU/memory costs.

> [MongoDB Aggregation Pipeline Optimization](https://www.mongodb.com/docs/manual/core/aggregation-pipeline-optimization/) -- Official docs on pipeline optimizer behavior

**Schema flexibility.** The Schema Versioning Pattern allows documents with different structures to coexist in the same collection. A `schema_version` field lets the application handle different document shapes. No downtime migrations. Supports eager migration, incremental migration, or no migration (maintain multiple versions).

> [Schema Versioning Pattern](https://www.mongodb.com/docs/manual/data-modeling/design-patterns/data-versioning/schema-versioning/) -- Official pattern documentation

**Vector search / LLM integration.** As of September 2025, MongoDB extended `$vectorSearch` and `$search` aggregation stages to Community Edition and Enterprise Server (previously Atlas-only). Native integrations with LangChain, LangGraph, and LlamaIndex. Functional parity with Atlas for search features.

> [MongoDB Extends Search to Self-Managed](https://investors.mongodb.com/news-releases/news-release-details/mongodb-extends-search-and-vector-search-capabilities-self) -- September 2025 announcement

### Go Driver

The official `mongo-go-driver` v2.4 is actively maintained by MongoDB. Key features:

- BSON unmarshal performance improved in v2.3 (fixed regression from v2.0)
- v2.2.1 added `sync.Pool` for encoding/decoding performance
- Connection pooling with automatic idle connection management
- Network compression (Snappy, Zlib, Zstandard)
- v2.3 introduced `bson.Vector` type for vector search
- Requires MongoDB 4.2+

> [mongo-go-driver GitHub](https://github.com/mongodb/mongo-go-driver) -- Official repository, v2.4 as of research date
>
> [Go Driver Release Notes](https://www.mongodb.com/docs/drivers/go/current/reference/release-notes/) -- Version history and changelog

### Deployment Complexity

**Kubernetes.** Three Helm chart options: MongoDB Community Operator (official, free), Bitnami chart (simpler but no management), Percona Operator (third-party). The Community Operator **lacks backups, restores, sharding, and upgrades** in the free tier. These features require Enterprise.

> [MongoDB Community Operator](https://artifacthub.io/packages/helm/mongodb-helm-charts/community-operator) -- ArtifactHub listing
>
> [Percona on Running MongoDB in K8s](https://www.percona.com/blog/run-mongodb-in-kubernetes-solutions-pros-and-cons/) -- Third-party assessment of K8s options

**Resource requirements.** Minimum 4 GB RAM recommended. WiredTiger cache defaults to `max(256 MB, (RAM - 1 GB) / 2)`. Needs at least 10 GB free disk. MongoDB recommends running on a dedicated system.

> [Production Notes](https://www.mongodb.com/docs/manual/administration/production-notes/) -- Official resource guidelines

**Backup/restore.** `mongodump`/`mongorestore` for BSON data dumps. Works for small deployments. For Kubernetes: `kubectl exec` to run dumps, CronJobs for scheduling, or cloud-agnostic approaches using MinIO/S3. Note: `mongodump` can adversely affect performance on the running instance and may push working set out of memory for large datasets.

> [Backup and Restore Tools](https://www.mongodb.com/docs/manual/tutorial/backup-and-restore-tools/) -- Official backup docs

### Licensing

SSPL (Server Side Public License) since October 2018. **For internal/self-hosted use: no restrictions.** The SSPL copyleft clause only triggers when offering MongoDB as a service to third parties. SSPL is not recognized as open-source by OSI, Red Hat, or Debian. Dropped from Debian, RHEL, and Fedora repositories.

> [SSPL FAQ](https://www.mongodb.com/legal/licensing/server-side-public-license/faq) -- MongoDB's own FAQ clarifying internal use
>
> [SSPL Wikipedia](https://en.wikipedia.org/wiki/Server_Side_Public_License) -- Neutral overview of licensing controversy

### Limitations

- Community Operator for Kubernetes lacks production features (backup, restore, sharding, upgrades)
- 4 GB RAM minimum is heavier than SQLite or PostgreSQL for a personal fleet manager
- SSPL license not recognized as open source by major distributions
- Aggregation pipelines have a learning curve distinct from SQL
- No native join equivalent; `$lookup` exists but is not designed for relational patterns

### Field Sentiment

MongoDB is the dominant document database by market share and adoption. Strong community, extensive documentation, mature tooling. Frequent criticism centers on the SSPL license change and the gap between Atlas (managed) and Community (self-hosted) feature sets. The September 2025 extension of vector search to self-managed was well received.

---

## CouchDB

### Facts and Capabilities

**Performance.** CouchDB 3.5.0 (released May 2025) introduced parallel reads independent from writes, yielding 10-40% more throughput with highly concurrent workloads. Performance overhead is primarily in assembling/decoding JSON. Batch operations recommended (1-10,000 documents per batch).

> [CouchDB 3.5 Performance](https://docs.couchdb.org/en/stable/maintenance/performance.html) -- Official performance documentation
>
> [CouchDB 3.5 Release](https://blog.couchdb.org/2025/05/) -- Release announcement

**Query capabilities.** Two query systems: MapReduce views (JavaScript) and Mango queries (JSON-based, similar to MongoDB find). Mango performance depends heavily on properly defined indexes. Views update incrementally. No equivalent to MongoDB aggregation pipelines for complex transformations.

> [Optimizing CouchDB Query Performance](https://medium.com/@firmanbrilian/optimizing-query-performance-and-index-design-in-couchdb-for-analytical-workloads-42999cc44768) -- Practical optimization guide

**Replication.** Master-master replication is a core CouchDB feature. Uses document revision numbers for conflict detection. REST API triggers replication between databases. This is CouchDB's standout capability for distributed/offline-first applications.

> [CouchDB Backup Documentation](https://docs.couchdb.org/en/stable/maintenance/backups.html) -- Official backup/replication docs

**Schema flexibility.** Fully schema-free. Stores native JSON documents. No schema versioning patterns needed since there is no schema to version.

### Go Driver

No official Go driver from the Apache project. Community options:

- **Kivik** (go-kivik/kivik v4): Most actively maintained. Common interface to CouchDB-like databases. Supports CouchDB 2.x+. Stable for production use.
- **couchdb-golang** (leesper): Inspired by CouchDB-Python. Targets CouchDB 2.x.
- **couchdb-go** (rhinoman): Basic driver for CouchDB 2.x.

All community-maintained. No corporate backing behind Go drivers.

> [Kivik on GitHub](https://github.com/go-kivik/kivik) -- Most active CouchDB Go library
>
> [CouchDB Go Wiki](https://cwiki.apache.org/confluence/display/COUCHDB/Go) -- Apache-maintained list of Go libraries

### Deployment Complexity

**Kubernetes.** Official Apache CouchDB Helm chart deploys as a StatefulSet with ClusterIP Service. Supports persistent volumes, Ingress configuration, and secret management for admin credentials. Straightforward deployment.

> [CouchDB Kubernetes Installation](https://docs.couchdb.org/en/stable/install/kubernetes.html) -- Official K8s deployment docs
>
> [CouchDB Helm Chart](https://artifacthub.io/packages/helm/couchdb/couchdb) -- ArtifactHub listing (v4.6.3)

**Resource requirements.** Lightweight. Can run on systems with as little as 1 GB of memory. No strict minimum published. Memory usage scales with dataset size and concurrent connections. The Erlang runtime (beam.smp) can consume significant RAM under load (reports of 15 GB+ when saturated).

**Backup/restore.** Three approaches: CouchDB replication to another instance (simplest), direct copy of `.couch` files (append-only format makes this safe), or tooling like `couchbackup` (streams `_changes` feed). Recommendation: back up secondary indexes before main database files since views newer than their databases trigger a full rebuild.

> [CouchDB Backup](https://docs.couchdb.org/en/stable/maintenance/backups.html) -- Official backup strategies

### Licensing

Apache License 2.0. Fully open source. No restrictions for any use case.

### Limitations

- No aggregation pipeline equivalent; complex data transformations require MapReduce or application-side logic
- Mango queries are less expressive than MongoDB queries
- No vector search or LLM-specific features
- Go driver ecosystem is community-maintained with no corporate backing
- Designed primarily for distributed/offline-first use cases, not single-node performance
- View index builds can be slow on initial creation

### Field Sentiment

CouchDB occupies a niche for offline-first and sync-heavy applications. Smaller community than MongoDB. The AAA game launch case study (10x performance gains) shows it handles specific workloads well, but general-purpose adoption has declined. The project remains actively maintained under the Apache Foundation. CouchDB and Couchbase are often confused but are separate products.

> [10x CouchDB Performance for AAA Game Launch](https://neighbourhood.ie/blog/2025/03/04/case-study-10x-couchdb-performance-gains-for-a-aaa-game-launch) -- Neighbourhoodie case study

---

## RavenDB

### Facts and Capabilities

**Performance.** Claims 1 million reads and 150,000 writes/sec per node on commodity hardware. 99th percentile query latency under 93 ms, average 87 ms. Uses a "transactional merger" that batches multiple transactions into single disk commits, reducing disk I/O by approximately 90%. ACID transactions across multiple documents.

> [RavenDB Performance Overview](https://ravendb.net/performance) -- Official performance claims (vendor source)
>
> [RavenDB vs MongoDB](https://ravendb.net/articles/ravendb-vs-mongodb-performance-cost-and-complexity) -- RavenDB-authored comparison (note source bias)

**Query capabilities.** Raven Query Language (RQL), which is SQL-like. Automatic index creation using machine learning. Built-in full-text search (no separate Elasticsearch needed). MapReduce aggregations included natively. Built-in management GUI (RavenDB Studio).

**Schema flexibility.** Schema-based around CLR objects but tolerates schema evolution. Documents stored as JSON internally. Handles varying document shapes within a collection.

**Vector search / LLM integration.** No native vector search capabilities found in the research. No documented LLM framework integrations (LangChain, LlamaIndex).

### Go Driver

Official Go client exists (`github.com/ravendb/ravendb-go-client`). Supports CRUD, querying, indexing, document streaming, patching, and subscriptions. Published on pkg.go.dev.

**Maturity concern:** The Go client was announced as a "preview" and specific information about production adoption rates of the Go client was not found. RavenDB's primary ecosystem is .NET/C#. The Go, Java, Python, and Node.js clients are secondary.

> [RavenDB Go Client](https://pkg.go.dev/github.com/ravendb/ravendb-go-client) -- pkg.go.dev listing
>
> [RavenDB Go Client Preview](https://ayende.com/blog/186306-C/ravendb-go-client-is-now-available-for-preview) -- Original announcement from Oren Eini

### Deployment Complexity

**Kubernetes.** Official Helm chart available. Deploys as a StatefulSet. Requires a "setup package" generated by the `rvn` CLI tool. Self-hosted Kubernetes deployments require manual DNS resolution and manual load balancer configuration (no cloud-provider integration for IP assignment).

> [RavenDB Helm Chart Deployment](https://ravendb.net/articles/deploying-ravendb-with-helm-chart) -- Official deployment guide

**Resource requirements.** Minimum 2 cores for basic setups, 4 cores for medium workloads. At least 1 GB RAM for minimal setups.

**Backup/restore.** Documented backup capabilities. The Community license lacks backup features in the operator; backup/restore is available but the Kubernetes operator support varies by license tier.

### Licensing

**Community (free):** Single node fully functional. Clustering limited to 3 nodes, 3 CPU cores, 6 GB RAM. License expires yearly (renewable). Must run the latest major version.

**Professional:** $789/year/core.

**Enterprise:** $1,389/year/core.

> [RavenDB Pricing](https://ravendb.net/buy) -- Official pricing page
>
> [Community License](https://ravendb.net/license/request/community) -- Free tier details

### Limitations

- Go client maturity is uncertain; announced as "preview," production adoption unknown
- Primary ecosystem is .NET/C#; Go is a secondary citizen
- Community license requires running latest major version and annual renewal
- Paid tiers required for clustering beyond 3 nodes or higher resource limits
- No vector search or LLM framework integrations
- Self-hosted Kubernetes deployment requires more manual configuration than MongoDB or CouchDB
- Smaller community than MongoDB or CouchDB

### Field Sentiment

RavenDB has a loyal following, particularly in the .NET ecosystem. Oren Eini (creator) is personally responsive on support forums. Performance claims are strong but most benchmarks are vendor-sourced. Independent adoption data is harder to find than for MongoDB. The "two years of pain and joy" blog post from a user highlights both strong performance and rough edges.

> [RavenDB: Two Years of Pain and Joy](https://alex-klaus.com/ravendb-pain-and-joy/) -- Independent user experience report

---

## PostgreSQL JSONB (Baseline)

Included because PostgreSQL is already in the fleet manager's supported stack.

### Facts and Capabilities

**Performance.** JSONB performance is on par with MongoDB until document size exceeds a few hundred bytes, then degrades once TOAST kicks in around 2 KB. TOAST stores large values out-of-line. Specific degradation: queries are 2-10x slower for values larger than ~2 KB. Compressed TOAST columns are ~2x slower than uncompressed; TOAST columns are ~5x slower than inline columns. Updates to any part of a TOASTed JSONB value require duplicating the entire value.

> [Postgres JSONB and TOAST Performance](https://pganalyze.com/blog/5mins-postgres-jsonb-toast) -- pganalyze analysis of TOAST impact
>
> [Postgres Large JSON Performance](https://www.evanjones.ca/postgres-large-json-performance.html) -- Independent benchmark with specific numbers

**The TOAST problem for this use case:** A single Wiki API Carrack document has 500-800+ fields across 8-10 nesting levels. This will exceed the 2 KB TOAST threshold significantly, placing it squarely in the degraded-performance zone for PostgreSQL JSONB.

**Indexing.** GIN indexes break apart JSONB documents and index keys/values. Two operator classes:

- `jsonb_ops` (default): Broader operator support, indexes can reach 60-80% of table size
- `jsonb_path_ops`: Smaller indexes (20-30% of table size), better search specificity, but fewer supported operators

The `@>` containment operator is GIN-indexable. Expression indexes and partial indexes are preferable to indexing entire large JSONB columns.

> [Indexing JSONB in Postgres](https://www.crunchydata.com/blog/indexing-jsonb-in-postgres) -- Crunchy Data practical guide
>
> [GIN Index Analysis](https://pganalyze.com/blog/gin-index) -- pganalyze deep dive on GIN trade-offs
>
> [JSONB Index Pitfalls](https://vsevolod.net/postgresql-jsonb-index/) -- Independent analysis of when GIN indexes help and hurt

**Query capabilities.** Full SQL with JSONB operators (`->`, `->>`, `@>`, `?`, `#>`). Can mix relational queries with JSON path expressions. The query optimizer handles complex queries well.

**Schema flexibility.** JSONB columns accept any valid JSON. Schema enforcement is optional (CHECK constraints, JSON Schema validation). Relational columns and JSONB columns can coexist in the same table.

### Go Driver

`pgx` (jackc/pgx) is the de facto standard PostgreSQL driver for Go. Mature, high-performance, actively maintained. Native JSONB support through `pgtype`. The fleet manager likely already uses this or `database/sql`.

### Deployment Complexity

Already in the stack. No additional deployment needed. CloudNativePG or Bitnami Helm charts for Kubernetes are well-established.

### Backup/restore

`pg_dump`/`pg_restore`, WAL archiving, point-in-time recovery. Mature, well-documented, widely understood.

### Licensing

PostgreSQL License (permissive, similar to MIT/BSD). No restrictions.

### Limitations

- TOAST performance cliff for documents >2 KB (directly relevant for Wiki API data)
- Updating a single field in a large JSONB document requires rewriting the entire value
- GIN indexes on large JSONB columns can become very large (60-80% of table size)
- No native aggregation pipeline; complex JSON transformations require SQL/application logic
- No native vector search (requires pgvector extension)

---

## Comparison

### Performance Characteristics

| Dimension | MongoDB | CouchDB | RavenDB | PostgreSQL JSONB |
|-----------|---------|---------|---------|-----------------|
| Read throughput (vendor claims) | 1M+/sec (8.0) | 10-40% improvement in 3.5 | 1M reads/sec | Comparable to MongoDB for small docs |
| Write throughput (vendor claims) | High (BSON field-level updates) | Batch-oriented (1-10K docs) | 150K writes/sec | Degrades with document size |
| Large document handling (>2 KB) | Flat performance curve across sizes | JSON encode/decode overhead | Good (JSON-native storage) | 2-10x degradation past TOAST threshold |
| Partial document updates | Native field-level updates | Full document replacement | Patching supported | Full JSONB value rewrite |
| Aggregation/analytics | Aggregation pipelines | MapReduce + Mango | RQL + MapReduce | SQL (powerful but verbose for JSON) |
| Query latency (p99) | Sub-ms to low ms (indexed) | Depends on view/index warmth | <93 ms (vendor claim) | Sub-ms for small docs, degrades with TOAST |

### Operational Characteristics

| Dimension | MongoDB | CouchDB | RavenDB | PostgreSQL JSONB |
|-----------|---------|---------|---------|-----------------|
| Min RAM (practical) | 4 GB | ~1 GB | 1 GB | ~256 MB (shared with relational) |
| K8s deployment | Community Operator (limited), Bitnami, Percona | Official Helm chart (simple) | Official Helm chart (manual DNS/LB) | CloudNativePG, Bitnami (mature) |
| K8s backup support | CronJob + mongodump (manual) | Replication or file copy | Varies by license tier | WAL archiving, pg_dump (mature) |
| Go driver maturity | Official v2.4, actively maintained | Community (Kivik v4), no corporate backing | Official but announced as "preview" | pgx, de facto standard |
| License | SSPL (free for internal use) | Apache 2.0 | Free tier (3 nodes, 3 cores, 6 GB) | PostgreSQL License (permissive) |
| Schema migration | Schema Versioning Pattern (no downtime) | No schema to migrate | Tolerates schema evolution | ALTER TABLE + JSONB flexibility |

### LLM and Search Integration

| Dimension | MongoDB | CouchDB | RavenDB | PostgreSQL JSONB |
|-----------|---------|---------|---------|-----------------|
| Vector search | $vectorSearch (Community Edition since Sep 2025) | None | None | pgvector extension |
| Full-text search | $search (built-in since Sep 2025) | Mango + MapReduce (limited) | Built-in full-text search | tsvector/tsquery (mature) |
| LLM framework support | LangChain, LlamaIndex, LangGraph | None documented | None documented | LangChain (via pgvector) |
| Data serialization for LLM | Native JSON/BSON | Native JSON | Native JSON | JSONB (binary, needs serialization) |

### Fit for Star Citizen Wiki Data

| Dimension | MongoDB | CouchDB | RavenDB | PostgreSQL JSONB |
|-----------|---------|---------|---------|-----------------|
| 500-800 field documents | Native fit | Native fit | Native fit | TOAST degradation |
| 8-10 levels nesting | Field-level indexing | Requires view design | Automatic indexing | GIN index on specific paths |
| Nightly bulk sync | Bulk insert API | Batch insert API | Bulk Insert API | COPY or batch INSERT |
| Component tree queries | $unwind + aggregation | MapReduce views | RQL | Recursive CTEs + JSONB operators |
| Ship spec lookups (web) | Fast (indexed fields) | Fast (with warm views) | Fast (automatic indexes) | Fast for small docs; slow if full doc >2 KB |

---

## Gaps

- **Independent benchmarks for this specific workload.** All performance numbers are vendor-sourced or from different workload profiles. No benchmark was found testing 500-800 field documents with 8-10 levels of nesting across these databases.

- **MongoDB Community Operator production experience.** The gap between Community and Enterprise for Kubernetes operations (no backup, no sharding, no upgrades in Community Operator) is documented, but real-world impact for single-node personal deployments is unclear.

- **RavenDB Go client production usage.** No production usage reports or independent reviews of the Go client were found. The "preview" label may be outdated but could not be confirmed.

- **CouchDB performance with deeply nested documents.** The 10x performance case study was for a game launch workload, not for deeply nested document queries. CouchDB's specific behavior with 8-10 level nesting is unknown.

- **PostgreSQL JSONB with hybrid approach.** Storing scalar fields relationally and only the full nested document in a JSONB column (avoiding queries against the JSONB for hot paths) was not benchmarked but could mitigate the TOAST issue. The current `RawJSON` field in the fleet manager already does this partially.

- **Actual document sizes in bytes.** The Wiki API Carrack response was analyzed structurally (500-800+ fields, 8-10 levels) but the raw byte size was not measured. The exact TOAST threshold behavior depends on the serialized byte size after compression.

- **CouchDB and RavenDB vector search roadmap.** Neither database has vector search today. Whether they plan to add it could not be determined.

---

## Summary

| Factor | MongoDB | CouchDB | RavenDB | PostgreSQL JSONB |
|--------|---------|---------|---------|-----------------|
| JSON-native storage | Yes (BSON) | Yes (JSON) | Yes (JSON) | Binary JSONB with TOAST |
| Large document performance | Strong | Unknown for deep nesting | Strong (claimed) | Degrades past ~2 KB |
| Go driver quality | Official, mature | Community-maintained | Official but unclear maturity | pgx, industry standard |
| K8s self-hosted ease | Moderate (operator gaps) | Simple (official chart) | Complex (manual DNS/LB) | Mature (CloudNativePG) |
| Operational overhead vs current stack | New system to operate | New system to operate | New system to operate | Already in stack |
| LLM/vector capabilities | Strong (since Sep 2025) | None | None | pgvector extension |
| License risk | SSPL (OK for internal) | None (Apache 2.0) | Free tier restrictions | None (permissive) |
| Community/ecosystem size | Largest | Small, niche | Small, .NET-centric | Largest (overall) |

Source incentives: MongoDB, RavenDB, and PostgreSQL vendor benchmarks are produced by organizations with commercial interest in favorable results. CouchDB benchmarks come from the Apache Foundation (nonprofit) and independent consultancies. Independent third-party benchmarks comparing all four on the same workload were not found.
