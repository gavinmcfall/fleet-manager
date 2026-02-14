---
description: Cloudflare database and storage options for future cloud deployment
tags: [cloudflare, d1, durable-objects, workers-kv, r2, cloud, migration]
audience: { human: 70, agent: 30 }
purpose: { research: 85, reference: 15 }
---

# Cloudflare Database & Storage Options

Research on Cloudflare's database products for potential future cloud deployment of Fleet Manager.

*Research date: 2026-02-14*

## Context

Fleet Manager currently runs self-hosted with SQLite (default) or PostgreSQL. Future hosted version could use Cloudflare Workers + edge database. This research catalogs Cloudflare's database offerings and their fit for the Fleet Manager use case.

## Cloudflare Database Products

### D1 (SQL Database)

**What it is**: Managed SQLite-compatible serverless database. Each database limited to 10 GB. Built for horizontal scaling across multiple smaller databases (per-user or per-tenant architectures).

> [D1 Documentation](https://developers.cloudflare.com/d1/)

**SQLite compatibility**: Uses SQLite's SQL semantics. Standard SQL statements work via D1 Client API.

**Pricing**:
- **Free tier**:
  - 5 million rows read/day
  - 100,000 rows written/day
  - 5 GB storage (total)
- **Paid tier**:
  - Rows read: First 25 billion/month included + $0.001 per million rows
  - Rows written: First 50 million/month included + $1.00 per million rows
  - Storage: First 5 GB included + $0.75/GB-month
- **No egress fees**: Bandwidth and data transfer are free
- **No idle charges**: Only billed for actual queries

> [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)

**Limitations**:
- 10 GB per database maximum
- See [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/) for full constraints

**Use cases**: "Relational data, including user profiles, product listings and orders, and/or customer data" - read-heavy serverless applications

**Production readiness**: Generally available on Free and Paid plans.

---

### Durable Objects (Stateful Workers + SQLite Storage)

**What it is**: Globally-unique Cloudflare Workers with persistent storage. Combines compute with durable state. Each object has a globally-unique name and attached storage, enabling stateful serverless applications.

> [Durable Objects Documentation](https://developers.cloudflare.com/durable-objects/)

**Storage capabilities**:

1. **In-Memory State**: Coordinate connections among multiple clients or events (e.g., WebSocket management)
2. **SQLite Storage API**: Transactional, strongly consistent, serializable storage. Now in general availability.

> [SQLite Storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)

**Key features**:
- Provisions geographically close to initial requests
- Scales to millions of objects worldwide
- WebSocket Hibernation for managing client connections at scale
- Durable Objects Alarms for scheduling future compute tasks

**Pricing**: SQLite storage billing enabled January 7, 2026. See [Durable Objects Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

**Use cases**:
- AI agents and collaborative applications
- Real-time interactions (chat, multiplayer games)
- Live notifications and distributed systems
- Coordination among multiple clients without manual state management

**vs D1**: D1 is a managed database product with HTTP API and schema management tools. Durable Objects give you SQLite storage *colocated with your application logic* on the same machine. More developer effort but potential performance benefits for complex queries.

---

### Workers KV (Global Key-Value Store)

**What it is**: Globally distributed key-value storage with low-latency reads worldwide.

> [Workers KV Documentation](https://developers.cloudflare.com/kv/)

**Access methods**:
- Workers Bindings (for Cloudflare Workers integration)
- REST API (for external applications)
- SDKs: TypeScript, Python, Go

**Consistency**: **Eventually consistent** (not immediately consistent across all edge locations)

**Pricing**: Available on Free and Paid plans (see [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/))

**Use cases**:
- Caching API responses
- Storing user configurations and preferences
- User authentication details
- Configuration data, service routing metadata, personalization (A/B testing)
- Session data, credentials (API keys)

**Workload fit**: High read volumes (thousands of RPS or more), infrequent writes (1 write per second per unique key limit), data that doesn't need immediate consistency.

**vs D1**: KV is for simple key-value lookups at massive scale. D1 is for queryable relational data with SQL.

---

### R2 (Object Storage)

**What it is**: S3-compatible blob storage without egress fees.

> [R2 Documentation](https://developers.cloudflare.com/r2/)

**Use cases**:
- User-facing web assets, images
- Machine learning and training datasets
- Analytics datasets
- Log and event data

**Key benefit**: No egress fees (unlike AWS S3 which charges for data transfer out).

**Not a database**: This is object storage for large unstructured files, not a database. Relevant for storing backups, database exports, or large assets.

---

## Product Comparison Matrix

| Product | Type | Consistency | Best For | Fleet Manager Fit? |
|---------|------|-------------|----------|-------------------|
| **D1** | SQL (SQLite) | Strongly consistent | Relational data, read-heavy queries | ✅ **Best fit** - SQLite compatibility |
| **Durable Objects** | Stateful Workers + SQLite | Strongly consistent | Real-time coordination, WebSockets | ❌ Overkill (no real-time needs) |
| **Workers KV** | Key-Value | Eventually consistent | Config, caching, high-read metadata | ⚠️ Could cache ship lookups |
| **R2** | Object Storage | N/A | Large files, backups | ⚠️ Could store DB backups |

> [Storage Options Comparison](https://developers.cloudflare.com/workers/platform/storage-options/)

---

## Fleet Manager Use Case Analysis

### Current State
- SQLite (default) or PostgreSQL
- ~800 FleetYards ships, ~38 user vehicles, auxiliary tables
- Workload: Read-heavy (nightly sync writes, constant reads)
- Self-hosted deployment (Kubernetes, Talos, Flux)

### D1 as Primary Database

**Fit**: Excellent
- SQLite-compatible (minimal migration from current SQLite setup)
- Read-heavy workload matches D1's strengths
- Free tier limits:
  - 5M reads/day = ~1,700 reads/minute sustained = plenty for single-user web app
  - 100K writes/day = sufficient for nightly sync operations
- Storage: Current dataset is tiny. Even with "vast majority of SC Wiki API", likely under 10 GB per database.

**Cost projection** (if expanding to 8 GB wiki data):
- Storage: 8 GB × $0.75/GB-month = $6/month
- Reads: Likely within free tier (25 billion/month included)
- Writes: Nightly sync = minimal cost

**10 GB limitation strategies**:
1. **Single database**: If wiki data stays under 10 GB (most likely)
2. **Sharded approach**: Separate databases (ships, components, celestial objects, galactapedia)
3. **Hybrid**: Current game version in D1, historical data in R2

### Potential Hybrid Architecture

**D1**: Primary database
- Ships, vehicles, hangar imports, sync metadata, settings, AI analyses
- Wiki API data (current game version)

**Workers KV**: Cache layer
- Frequently accessed lookups (manufacturer list, role categories, ship counts)
- Session data if multi-user
- Configuration data

**R2**: Archive storage
- Nightly backup exports (SQLite dumps)
- Historical analysis archives
- Old game version data

### Migration Path from Self-Hosted

**Phase 1**: Keep SQLite locally (current state)

**Phase 2**: Dual-deployment testing
- Self-hosted version continues to run
- Test Workers + D1 deployment with replicated data
- Validate SQL compatibility, performance

**Phase 3**: Hybrid (self-hosted + cloud)
- Self-hosted for primary use
- Cloud version for remote access, sharing

**Phase 4**: Full migration (if desired)
- SQLite → D1 via SQL export/import
- Existing dual-driver abstraction (`placeholder()`, `autoIncrement()`, `onConflictUpdate()`) already handles dialect differences

**Migration complexity**: Low to Medium
- SQL dialect is SQLite-compatible (same as current default)
- No ORM to migrate (using `database/sql` with manual SQL)
- Main work: Workers deployment patterns, API routing, auth (if adding multi-user)

---

## Key Decision Factors

### When D1 Makes Sense

✅ SQLite compatibility matters (existing investment)
✅ Read-heavy workload with periodic bulk writes
✅ Dataset under 10 GB (or can be sharded)
✅ Want serverless deployment (no server management)
✅ Need global distribution with low latency
✅ Cost-sensitive (free tier generous, paid tier cheap)

### When D1 Does NOT Make Sense

❌ Need PostgreSQL-specific features (JSONB performance, extensions like pgvector)
❌ Dataset exceeds 10 GB and can't be sharded
❌ Write-heavy workload (writes are 1000× more expensive than reads)
❌ Need complex transactions across multiple databases
❌ Require PostgreSQL ecosystem (CloudNativePG, mature tooling)

### D1 vs Self-Hosted PostgreSQL

| Dimension | D1 | Self-Hosted PostgreSQL |
|-----------|----|-----------------------|
| **Ops complexity** | Zero (managed) | Medium (CloudNativePG operator) |
| **Cost** | $0-6/month (for this workload) | Compute/storage costs (K8s resources) |
| **SQL dialect** | SQLite | PostgreSQL |
| **Extensions** | None | pgvector, pg_trgm, pg_search, TimescaleDB, AGE |
| **JSON handling** | SQLite JSONB (O(N) lookups) | PostgreSQL JSONB (O(1), GIN indexes) |
| **Size limit** | 10 GB per database | No practical limit |
| **Global distribution** | Automatic (edge network) | Manual (replicas, CDN) |
| **Backup** | Automatic | Manual (pg_dump, WAL archiving) |

---

## Sources

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Workers KV Documentation](https://developers.cloudflare.com/kv/)
- [R2 Object Storage](https://developers.cloudflare.com/r2/)
- [Storage Options Comparison](https://developers.cloudflare.com/workers/platform/storage-options/)
- [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Durable Objects Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [SQLite Storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)

---

## Summary

**D1 is Cloudflare's answer to "SQLite in the cloud."** For Fleet Manager:

1. **Natural migration path**: SQLite (self-hosted) → D1 (Cloudflare Workers)
2. **Cost-effective**: Free tier covers single-user workload, paid tier is ~$6/month for 8 GB
3. **Low migration complexity**: Same SQL dialect, existing dual-driver abstraction handles differences
4. **Hybrid deployment possible**: Self-hosted primary + cloud for remote access

**Trade-off vs PostgreSQL**: Lose extension ecosystem (pgvector, pg_trgm, pg_search) and JSONB performance, but gain serverless simplicity and global edge distribution.

**Recommended approach**: Keep SQLite self-hosted for now. When cloud deployment needed, D1 is the natural choice given existing SQLite compatibility.
