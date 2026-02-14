---
description: Research into graph databases for Star Citizen ship data — whether relationship-heavy queries justify leaving relational
tags: [database, graph, neo4j, arangodb, dgraph, postgresql, apache-age, architecture]
audience: { human: 75, agent: 25 }
purpose: { research: 90, reference: 10 }
---

# Graph Databases for Star Citizen Ship Data

Research for deciding whether graph database capabilities would benefit fleet-manager's ship relationship queries (upgrade paths, loaner chains, component loadouts) over the current relational approach.

*Research date: 14 February 2026*

## Context

Fleet-manager currently uses SQLite (with PostgreSQL option) for ship data. The data model includes ships, vehicles (user hangar), hangar imports (insurance/pledge data), manufacturers, items/components, and various Star Citizen reference tables (sc_vehicles, sc_items, sc_manufacturers, etc.).

The question is whether relationships in this domain — manufacturers to ships, ships to components, ships to loaners, CCU upgrade chains between ships — would benefit from native graph traversal versus SQL JOINs.

Scope: Neo4j, ArangoDB, Dgraph as dedicated graph databases; Apache AGE as a PostgreSQL hybrid approach; FalkorDB as a lightweight alternative. Self-hosted deployment on a homelab Kubernetes cluster. Speed matters for both web UI and LLM integration.

Out of scope: Cloud-managed graph services, enterprise pricing tiers.

---

## When Graph Databases Outperform Relational

Graph databases store relationships as first-class citizens (direct pointers between nodes) rather than computing them at query time via JOINs. This architectural difference creates measurable performance differences in specific scenarios.

**Where graphs are faster:**

| Scenario | Graph advantage | Source |
|----------|----------------|--------|
| Deep traversals (4+ hops) | Orders of magnitude | Pointer chasing vs recursive JOINs |
| Arbitrary path queries (1000 nodes) | ~1000x (2ms vs 2000ms) | [MDPI Applied Sciences](https://www.mdpi.com/2076-3417/12/13/6490) |
| Complex pattern matching | Up to 146x on large datasets | [ResearchGate](https://www.researchgate.net/publication/370751317_Performance_Comparison_of_Graph_Database_and_Relational_Database) |
| Multi-hop relationship discovery | Constant-time per hop | Index-free adjacency design |

**Where relational is faster:**

| Scenario | Relational advantage | Source |
|----------|---------------------|--------|
| Aggregations (GROUP BY, SUM, COUNT) | Purpose-built optimizers | [Springer](https://link.springer.com/article/10.1007/s41019-019-00110-3) |
| Sorting and filtering flat data | Decades of optimizer maturity | Same |
| Simple lookups by ID or indexed field | Near-zero overhead | Standard B-tree indexes |
| Bulk writes / transactions | ACID optimization at scale | Relational MVCC |

**The crossover point:** Graph databases show significant performance advantages when queries involve 4+ relationship hops, pattern matching across multiple relationship types, or pathfinding between nodes. For queries that can be expressed as 2-3 JOINs, relational databases are typically faster and simpler.

> [Memgraph Blog](https://memgraph.com/blog/graph-database-vs-relational-database) — "Graph databases make most sense when running complex analytical or pathfinding queries with 4 or more traversals"

> [PuppyGraph](https://www.puppygraph.com/blog/graph-database-vs-relational-database) — "The overhead of maintaining a graph structure outweighs any benefits for straightforward relationships"

**An important nuance:** One benchmark found that while Neo4j is more efficient for simple graph queries, MariaDB was more efficient as query complexity increased. This challenges the blanket assumption that graph databases always win for relationship-heavy queries.

> [DZone](https://dzone.com/articles/performance-graph-vs) — Performance comparison with surprising results at higher complexity

---

## Neo4j

The most widely adopted graph database. Property graph model with the Cypher query language.

**Licensing:**
- Community Edition: GPLv3. Single-node only, no clustering, no hot backups. Cannot offer a product/service primarily derived from Neo4j without commercial agreement.
- Enterprise Edition: Commercial license required. Clustering, hot backups, monitoring, role-based access control.
- Free Enterprise Developer License: single-machine use via Neo4j Desktop.
- Startup License: available for companies with up to 20 employees.

> [Neo4j Licensing Blog](https://neo4j.com/blog/news/open-core-licensing-model-neo4j-enterprise-edition/) — Licensing model details

**Deployment:**
- Official Docker image: `neo4j:2026.01.4` (Community), `neo4j:2026.01.4-enterprise` (Enterprise)
- Official Helm chart for Kubernetes. Community Edition deploys as single pod.
- Requires JVM (Java 25+ for Neo4j 2025.10+).
- Filesystem requirement: EXT4 or XFS only on Linux.
- Memory: 1GB minimum for OS, plus heap and page cache. Page cache sizing depends on dataset. For a small dataset (thousands of nodes), 512MB-1GB total is workable.

> [Neo4j System Requirements](https://neo4j.com/docs/operations-manual/current/installation/requirements/) — Hardware guidance
> [Neo4j Docker Hub](https://hub.docker.com/_/neo4j) — Docker images
> [Neo4j Kubernetes Docs](https://neo4j.com/docs/operations-manual/current/kubernetes/) — Helm deployment

**Go Integration:**
- Official driver: `github.com/neo4j/neo4j-go-driver/v5` (stable), v6 released with Neo4j 2025.x support.
- Uses Bolt protocol over TCP.
- Connection pooling built in; one driver instance per application recommended.
- Lazy result streaming available via `ExecuteRead/Write()`.
- Performance tip: create indexes on frequently filtered properties; specify target database on all queries to avoid extra server round-trip.

> [Neo4j Go Driver Manual](https://neo4j.com/docs/go-manual/current/performance/) — Performance recommendations
> [neo4j-go-driver GitHub](https://github.com/neo4j/neo4j-go-driver) — Driver source

**Cypher Query Language:**
- ASCII-art syntax for pattern matching: `(a)-[:LENDS_TO]->(b)`
- SQL-like keywords (MATCH, WHERE, RETURN, ORDER BY)
- Neo4j claims learnable in ~60 minutes via their free course.
- Well-documented with extensive examples and community resources.

> [Neo4j Cypher Tutorial](https://neo4j.com/docs/getting-started/cypher/intro-tutorial/) — Getting started
> [Learn Cypher in Y Minutes](https://learnxinyminutes.com/cypher/) — Quick reference

**LLM Integration:**
- Native vector index (HNSW) for embedding similarity search.
- GraphRAG ecosystem: LangChain `GraphCypherQAChain` for natural-language-to-Cypher translation.
- Neo4j LLM Knowledge Graph Builder (open source) for extracting entities/relationships from unstructured text.
- Hybrid retrieval: vector similarity + graph traversal. Reported 67% relevance improvement over pure vector search in one code search benchmark (500K+ functions).
- FalkorDB (separate product) reports 90% hallucination reduction vs traditional RAG with sub-50ms latency.

> [Neo4j Vector Search](https://neo4j.com/developer/genai-ecosystem/vector-search/) — Vector index docs
> [Neo4j GraphRAG Blog](https://neo4j.com/blog/developer/hybrid-retrieval-graphrag-python-package/) — Hybrid retrieval
> [Neo4j LLM KG Builder](https://neo4j.com/blog/developer/llm-knowledge-graph-builder-release/) — Knowledge graph builder

**Field Sentiment:**
Graph and network analytics usage grew 700% from 2021-2025 per Gartner. Neo4j is the dominant player in the graph database market. Large community, extensive documentation, broad ecosystem. The GPLv3 Community Edition licensing and single-node limitation are the most common complaints for self-hosted use cases.

---

## ArangoDB

Multi-model database: document store, graph database, and key-value store in one engine. Uses AQL (ArangoDB Query Language).

**Licensing:**
- Community Edition: ArangoDB Community License (not open source). Limits production deployments to **100GB dataset size**. Cannot be used for commercial purposes — only internal business purposes. Cannot distribute or embed within products.
- Enterprise Edition: Commercial license. No dataset limits, additional features (SmartGraphs, encryption at rest, LDAP).
- From v3.12+, the old Apache 2.0 license no longer applies to new versions.

> [ArangoDB Community License](https://arangodb.com/community-license/) — License terms
> [ArangoDB Licensing Blog](https://arango.ai/blog/evolving-arangodbs-licensing-model-for-a-sustainable-future/) — License changes

**Deployment:**
- Official Docker image: `arangodb/arangodb`
- Kubernetes Operator: `kube-arangodb` with Helm chart. Operator pod requires 256MB RAM and 250m CPU.
- Memory auto-detection based on available RAM. RocksDB block cache default: `(detected_RAM - 2GB) * 0.3`.
- For a small dataset, 1-2GB allocated RAM is workable.

> [ArangoDB Docker Hub](https://hub.docker.com/_/arangodb) — Docker image
> [kube-arangodb GitHub](https://github.com/arangodb/kube-arangodb) — Kubernetes operator

**Go Integration:**
- Official driver: `github.com/arangodb/go-driver/v2` (v1 deprecated).
- Published November 2025.
- Maintains active releases.

> [ArangoDB Go Driver](https://pkg.go.dev/github.com/arangodb/go-driver/v2/arangodb) — Package docs
> [go-driver GitHub](https://github.com/arangodb/go-driver) — Driver source

**AQL Query Language:**
- SQL-like syntax with graph traversal extensions.
- Handles documents, graphs, and key-value in one language.
- ArangoDB's documentation includes SQL-to-AQL comparison guide.
- AQL is not a DDL — schema is managed separately.
- Multi-model queries in a single statement (e.g., traverse graph, filter by document properties, aggregate results).

> [SQL/AQL Comparison](https://arangodb.com/sql-aql-comparison/) — Side-by-side syntax
> [AQL vs Cypher](https://arangodb.com/learn/graphs/comparing-arangodb-aql-neo4j-cypher/) — Graph query comparison

**Field Sentiment:**
Rated #1 Graph Database for Fall 2025 in one ranking. The multi-model approach appeals to teams that want graph capabilities without running a separate database. The 100GB Community Edition limit is the main concern for growing datasets. The licensing change from Apache 2.0 to BUSL/Community License caused friction in the community.

> [Hacker News Discussion](https://news.ycombinator.com/item?id=37850833) — Community reaction to license change

---

## Dgraph

Graph database written in Go, with native GraphQL support and its own DQL (Dgraph Query Language).

**Licensing:**
- Community Edition: Apache 2.0 license (open source).
- Enterprise features (ACLs, encryption, binary backups) require license.

**Ownership History:**
- Founded as Dgraph Labs
- Acquired by Hypermode Inc. in 2023
- Acquired by Istari Digital in October 2025
- Two ownership changes in two years raises questions about long-term stewardship

> [Dgraph Welcome to Istari](https://discuss.dgraph.io/t/dgraph-welcome-to-istari/20021) — Acquisition announcement
> [PR Newswire](https://www.prnewswire.com/news-releases/istari-digital-acquires-dgraph-to-strengthen-data-foundation-for-ai-and-engineering-302593246.html) — Acquisition details

**Deployment:**
- Docker image: `dgraph/dgraph`
- Production minimum: 8 CPUs, 16GB RAM per node (minimum of one Zero + one Alpha process)
- Testing minimum: 8 CPUs, 16GB RAM
- Should not run on burstable instances (e.g., AWS t2 class)
- Significantly heavier resource requirements than Neo4j or ArangoDB for the same workload

> [Dgraph Production Checklist](https://dgraph.io/docs/deploy/installation/production-checklist/) — Hardware requirements

**Go Integration:**
- Written in Go natively — the entire database is a Go application.
- Official Go client: `github.com/dgraph-io/dgo`
- gRPC-based communication.
- Deep Go ecosystem integration.

> [Dgraph Go Client Docs](https://docs.dgraph.io/clients/go/) — Go client

**Query Languages:**
- DQL (Dgraph Query Language): GraphQL-like syntax, designed for graph operations.
- Native GraphQL support: define schema, get GraphQL API automatically.
- Less community adoption than Cypher. Fewer learning resources available.

**Field Sentiment:**
The Go-native implementation is a genuine technical advantage for Go applications. However, the resource requirements (8 CPU / 16GB RAM minimum) are heavy for a homelab, and the two ownership changes create uncertainty. Current documentation is being migrated between domains. A 2026 article lists "Top 5 Dgraph Alternatives" which indicates some community movement away from the product.

> [PuppyGraph Dgraph Alternatives](https://www.puppygraph.com/blog/dgraph-alternatives) — Alternative analysis

---

## Apache AGE (PostgreSQL Extension)

PostgreSQL extension that adds openCypher graph query support to existing PostgreSQL databases. The hybrid approach.

**How It Works:**
- Installs as a PostgreSQL extension (`CREATE EXTENSION age`)
- Stores graph data in PostgreSQL tables
- Enables Cypher queries via `SELECT * FROM cypher('graph_name', $$ MATCH ... $$) AS (result agtype)`
- Can mix SQL and Cypher in the same query
- Same ACID guarantees as PostgreSQL

**Deployment:**
- Docker image: `apache/age` (PostgreSQL with AGE pre-installed)
- Supports PostgreSQL 11 through 18
- No additional infrastructure — runs inside existing PostgreSQL
- Zero additional memory/CPU beyond what PostgreSQL already uses

> [Apache AGE](https://age.apache.org/) — Project home
> [Apache AGE Docker](https://hub.docker.com/r/apache/age) — Docker image
> [Apache AGE GitHub](https://github.com/apache/age) — Source

**Go Integration:**
- Official Go driver: `github.com/apache/age/drivers/golang` (requires Go 1.18+)
- Third-party driver: `github.com/rhizome-ai/apache-age-go`
- Both use standard `database/sql` interface
- Compatible with existing pgx driver (fleet-manager already uses `github.com/jackc/pgx/v5`)
- Each connection must load the AGE extension: `SET search_path = ag_catalog, "$user", public;`

> [Apache AGE Go Driver](https://github.com/apache/age/blob/master/drivers/golang/README.md) — Driver docs
> [apache-age-go](https://pkg.go.dev/github.com/rhizome-ai/apache-age-go) — Third-party driver

**Performance:**
- On small datasets, recursive CTEs outperform AGE Cypher queries (~0.8ms CTE vs ~1.5ms AGE vs ~3.7ms raw AGE in one benchmark)
- For deep traversals on large graphs, AGE would approach native graph database performance
- Caching layer: `ag_cache` for metadata, `age_global_graph` for graph context

> [Postgres and Apache AGE](https://sorrell.github.io/2020/12/10/Postgres-and-Apache-AGE.html) — Performance comparison (2020, small dataset)

**Licensing:**
- Apache License 2.0 — fully open source, no restrictions.

**Field Sentiment:**
The pragmatic choice for teams already invested in PostgreSQL. No new infrastructure, no new backup strategy, no new monitoring. The trade-off is that it won't match native graph database performance for very deep traversals, and the Go driver ecosystem is less mature than Neo4j's. The project is actively maintained under the Apache Foundation.

---

## FalkorDB

Lightweight graph database built as a Redis module. Successor to RedisGraph (EOL).

**Key Characteristics:**
- Runs as a Redis module — requires Redis 7.4+
- Uses GraphBLAS sparse adjacency matrices for graph representation
- Supports openCypher query language
- Sub-83ms p99 latency reported
- Designed for real-time AI/agent workloads and GraphRAG

**Go Integration:**
- Go client: `github.com/FalkorDB/falkordb-go` (based on Redis client)
- Any Redis Go client can issue FalkorDB commands

**Deployment:**
- Docker: runs inside Redis container with module loaded
- Lightweight: Redis memory footprint + graph data
- No JVM, no separate cluster processes

**Licensing:**
- Server Side Public License (SSPL) — same as MongoDB's license. Free to use, but cannot offer as a service.

> [FalkorDB GitHub](https://github.com/FalkorDB/FalkorDB) — Source
> [FalkorDB Docs](https://docs.falkordb.com/) — Documentation
> [RedisGraph Migration](https://www.falkordb.com/blog/redisgraph-eol-migration-guide/) — Migration from RedisGraph

**Field Sentiment:**
Positioned as the performance-oriented graph database for AI applications. The Redis dependency is both a strength (simple ops if you already run Redis) and a limitation (data must fit in memory). Less mature ecosystem than Neo4j or ArangoDB.

---

## Fleet-Manager Data Model Analysis

Looking at the current fleet-manager schema (`/home/gavin/my_other_repos/fleet-manager/internal/database/migrations.go` and `/home/gavin/my_other_repos/fleet-manager/internal/models/models.go`):

**Current relationships (all implemented as SQL JOINs or foreign keys):**

| Relationship | Current implementation | Depth |
|---|---|---|
| Vehicle -> Ship (reference data) | `LEFT JOIN ships s ON v.ship_slug = s.slug` | 1 hop |
| Vehicle -> HangarImport (insurance) | `LEFT JOIN hangar_imports hi ON hi.vehicle_id = v.id` | 1 hop |
| Ship -> Manufacturer | Denormalized (stored as columns on ship) | 0 hops |
| SC Vehicle -> Manufacturer | `manufacturer_id` foreign key | 1 hop |
| SC Item -> Manufacturer | `manufacturer_id` foreign key | 1 hop |
| SC Vehicle -> Game Version | `game_version_id` foreign key | 1 hop |

**Current query patterns:** All existing queries are 1-2 hop JOINs. The deepest query is `GetVehiclesWithInsurance` which does a 2-way LEFT JOIN (vehicles -> ships, vehicles -> hangar_imports). These are the bread and butter of relational databases.

**Potential graph-friendly queries (not yet implemented):**

| Query | Estimated depth | Graph benefit |
|---|---|---|
| "Show CCU upgrade path from Aurora to Carrack" | Variable (1-10+ hops) | High |
| "Which ships grant this loaner?" | 1-2 hops | Low |
| "What components does this ship share with that ship?" | 2-3 hops | Medium |
| "Show all ships reachable via CCU chain under $X budget" | Variable path + filtering | High |
| "What manufacturer makes ships filling this role?" | 1-2 hops | Low |
| "Map all relationships between my fleet ships" | N hops, pattern matching | High |

The CCU chain optimization problem (find cheapest upgrade path from Ship A to Ship B using available warbond CCUs) is a classic shortest-path/cheapest-path graph problem. This is where graph databases genuinely excel.

---

## Comparison

| Dimension | Neo4j Community | ArangoDB Community | Dgraph | Apache AGE | FalkorDB |
|---|---|---|---|---|---|
| **License** | GPLv3 | BUSL / Community License | Apache 2.0 | Apache 2.0 | SSPL |
| **Data size limit** | None | 100GB production | None | None (PostgreSQL limit) | Memory-bound |
| **Query language** | Cypher | AQL | DQL / GraphQL | Cypher (in SQL) | Cypher |
| **Go driver maturity** | High (official, v6) | Medium (official, v2) | High (native Go) | Low (community) | Low (Redis-based) |
| **Min RAM (small workload)** | ~512MB-1GB | ~1-2GB | ~16GB | 0 (uses PostgreSQL) | ~256MB + Redis |
| **K8s deployment** | Helm chart (single pod CE) | Operator + Helm | StatefulSet (Zero+Alpha) | N/A (PostgreSQL pod) | Redis pod + module |
| **Additional infra** | JVM, dedicated pod | Dedicated pod | 2+ pods minimum | None | Redis 7.4+ |
| **Multi-model** | Graph only | Document + Graph + KV | Graph only | Graph + Relational | Graph only |
| **Vector search** | Native HNSW | Via ArangoSearch | No | Via pgvector | No |
| **LLM ecosystem** | Strongest (LangChain, GraphRAG) | Growing | Limited | Via PostgreSQL ecosystem | Emerging (GraphRAG focus) |
| **Learning curve from SQL** | New language (Cypher) | Moderate (AQL ~SQL) | New language (DQL) | Low (Cypher in SQL) | New language (Cypher) |

### Migration Effort from Current Architecture

| Option | What changes | Effort |
|---|---|---|
| Neo4j | New database, new driver, rewrite all queries, new backup/monitoring | High |
| ArangoDB | New database, new driver, rewrite all queries, new operator | High |
| Dgraph | New database, new driver, rewrite all queries, heavy resource footprint | High |
| Apache AGE | Add extension to PostgreSQL, add graph queries alongside SQL | Low-Medium |
| FalkorDB | Add Redis, add graph queries for specific features | Medium |

---

## Gaps

- **CCU chain data source**: The fleet-manager does not currently import CCU/upgrade data. A graph database only helps if this data exists. The CCU chain tools (ccugame.app, SC Org Tools, The Impound) have this data, but API availability is unclear.
- **Component/loadout data**: The sc_items table exists but component-to-ship mounting relationships are not yet modeled. Without this relationship data, graph queries have nothing to traverse.
- **Apache AGE Go driver maturity**: The official driver and the third-party driver are both lightly maintained. Production reliability at scale is unverified.
- **ArangoDB CTE vs AGE benchmark**: The only performance comparison found (2020) used small datasets. No large-scale AGE vs native graph DB benchmarks were found.
- **Dgraph post-acquisition stability**: Istari Digital acquired Dgraph in October 2025. Long-term roadmap and community investment are unclear.
- **FalkorDB Go client**: Based on the deprecated RedisGraph Go client. Current maintenance status unclear.
- **Real-world Star Citizen graph workloads**: No published examples of graph databases being used for Star Citizen fleet/CCU data were found.

---

## Summary

The fleet-manager's current queries are 1-2 hop JOINs over a small dataset (~38 ships, ~700 reference ships, ~thousands of items). This workload is firmly in relational database territory. Introducing a dedicated graph database for these queries would add operational complexity without measurable query performance benefit.

The graph database value proposition becomes relevant if and when:
1. CCU chain/upgrade path data is imported and pathfinding queries are needed
2. Component loadout relationships are modeled and cross-ship comparison queries span 3+ hops
3. The "fleet relationship map" visualization requires arbitrary-depth traversal

For the hybrid approach, Apache AGE on PostgreSQL offers graph query syntax without new infrastructure, though its Go driver ecosystem is immature. Adding AGE to an existing PostgreSQL deployment is the lowest-friction path to experimenting with graph queries.

For LLM integration specifically, Neo4j has the strongest ecosystem (vector search, GraphRAG, LangChain integration, knowledge graph builder). If LLM-powered fleet analysis evolves to need structured knowledge graph retrieval rather than flat context injection, Neo4j becomes the most practical choice despite the operational overhead.

| Workload characteristic | Current fleet-manager | Graph DB threshold |
|---|---|---|
| Relationship depth | 1-2 hops | 4+ hops |
| Dataset size | ~1000 nodes | 10K+ nodes with dense connections |
| Query pattern | Filter, sort, aggregate | Pathfinding, pattern matching |
| Relationship variety | 3-4 types | 10+ types with complex interactions |
