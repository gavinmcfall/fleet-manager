---
description: Star Citizen Wiki API endpoints, payload structures, and data relationships
tags: [star-citizen, wiki-api, api-research, database-design, sync-strategy]
audience: { human: 50, agent: 50 }
purpose: { research: 85, reference: 15 }
---

# Star Citizen Wiki API Research

Research on the Star Citizen Wiki API (api.star-citizen.wiki) for database replication and nightly sync implementation.

*Research date: 2026-02-14*

## Context

Fleet Manager currently uses FleetYards API for ship data. To expand coverage to the "vast majority of SC Wiki API" (components, celestial objects, galactapedia, etc.), we need to understand:

1. What endpoints exist and what they return
2. Payload sizes and nesting complexity
3. Entity relationships and foreign key structure
4. Data volumes and growth rates
5. Rate limits and sync strategies

This research informs database schema design and sync implementation.

---

## API Overview

**Base URL**: `https://api.star-citizen.wiki/api/`

**Authentication**: None required for read operations

**Documentation**: OpenAPI 3.0 spec at `/docs/openapi`

**Cache behavior**: Cloudflare CDN with 12-hour TTL

**Conditional requests**: Supports `If-Modified-Since` / `Last-Modified` headers

**Pagination**: Max page size 200 items

---

## Endpoint Catalog

### 1. Vehicles (Ground & Space)

| Endpoint | Purpose | Count | List Size | Detail Size |
|----------|---------|-------|-----------|-------------|
| `/vehicles` | All vehicles (ships + ground) | 288 | ~10 KB/page | - |
| `/vehicles/{slug}` | Individual vehicle detail | - | - | 5-680 KB |
| `/ground-vehicles` | Ground vehicles only | ~40 | ~8 KB/page | - |
| `/ships` | Ships only | ~248 | ~9 KB/page | - |

**Key fields**: `uuid`, `name`, `slug`, `manufacturer_uuid`, `size`, `focus`, `production_status`, `hardpoints[]`

**Nesting depth**: Up to 13 levels (turret children → turret children → ...)

**Largest payload**: Polaris at 679.7 KB (95% hardpoints)

### 2. Ship Components & Items

| Endpoint | Purpose | Count | Avg Size |
|----------|---------|-------|----------|
| `/items` | All items (components, weapons, armor, etc.) | 19,288 | 2-9 KB |
| `/items/{uuid}` | Individual item detail | - | 2-9 KB |
| `/ship-items` | Ship components only | 2,853 | 2-5 KB |
| `/weapon-items` | Weapons only | ~800 | 3-7 KB |
| `/armor-items` | Personal armor | ~200 | 2-4 KB |
| `/clothing-items` | Clothing | ~500 | 2-3 KB |
| `/food-items` | Consumables | ~150 | 2 KB |

**Type distribution**:
- Ship components: 2,853 (coolers, shields, power plants, quantum drives, etc.)
- Weapons: ~800 (ship + FPS)
- Personal equipment: ~1,200 (armor, clothing, tools)
- Consumables: ~150
- Other: ~14,285 (paints, decorations, mission items, etc.)

### 3. Manufacturers

| Endpoint | Purpose | Count |
|----------|---------|-------|
| `/manufacturers` | All manufacturers | 124 |
| `/manufacturers/{slug}` | Manufacturer detail | - |

**Key fields**: `uuid`, `name`, `slug`, `code`, `description`

**Relationship**: Ships/items reference manufacturers via `manufacturer_uuid` FK

### 4. Celestial Objects (Star Map)

| Endpoint | Purpose | Count |
|----------|---------|-------|
| `/celestial-objects` | All celestial objects | 877 |
| `/celestial-objects/{slug}` | Individual object | - |
| `/star-systems` | Star systems only | 95 |
| `/planets` | Planets only | ~180 |
| `/moons` | Moons only | ~250 |
| `/space-stations` | Stations only | ~120 |

**Hierarchy**: Star Systems → Planets → Moons → Space Stations

**Key fields**: `uuid`, `name`, `slug`, `type`, `parent_uuid`, `star_system_uuid`

**Self-referencing**: Moons reference planets via `parent_uuid`, planets reference star systems

### 5. Galactapedia

| Endpoint | Purpose | Count |
|----------|---------|-------|
| `/galactapedia` | All articles | 1,477 |
| `/galactapedia/{slug}` | Article detail | - |

**Content**: Markdown text, image URLs, related articles

**Size**: 1-50 KB per article (mostly text)

### 6. Shops & Commodities

| Endpoint | Purpose | Count |
|----------|---------|-------|
| `/shops` | In-game shops | ~300 |
| `/shops/{slug}` | Shop detail + inventory | - |
| `/commodities` | Tradeable commodities | ~150 |

**Relationship**: Shops → Items (many-to-many via junction)

### 7. Game Versions

| Endpoint | Purpose |
|----------|---------|
| `/versions` | Game version history |
| `/versions/{slug}` | Version detail |

**Purpose**: Track data changes across game patches

**Current live version**: 3.24.2 (as of Feb 2026)

### 8. Other Endpoints

- `/stats/latest` - Latest API update timestamps per category
- `/tags` - Classification tags (flair, paints, etc.)
- `/sc-data` - Raw game file exports (very large)
- `/quick-stats` - API coverage summary

---

## Payload Structures

### Vehicle Detail Example (Simplified)

```json
{
  "uuid": "abc123",
  "name": "Carrack",
  "slug": "carrack",
  "manufacturer": {
    "uuid": "def456",
    "name": "Anvil Aerospace",
    "slug": "anvil"
  },
  "size": "Capital",
  "focus": "Expedition",
  "production_status": "flight-ready",
  "hardpoints": [
    {
      "uuid": "hp1",
      "name": "Turret 1",
      "type": "turret",
      "category": "weapon",
      "item": {
        "uuid": "item1",
        "name": "S4 Ballistic Cannon",
        "manufacturer_uuid": "ghi789"
      },
      "children": [
        {
          "uuid": "hp2",
          "name": "Turret 1 Mount 1",
          "type": "mount",
          "item": {...}
        }
      ]
    }
  ]
}
```

### Hardpoints Structure

**Recursive nesting**: `hardpoints[].children[]` can contain more hardpoints

**Max depth observed**: 13 levels (Polaris turrets)

**Payload impact**: 95-96% of large ship detail payloads are hardpoints

**Relationship**: Hardpoint → Item (many-to-one via `item.uuid`)

### Items vs Ship Components

**Items** (19,288 total):
- Broad category including armor, weapons, decorations, paints, etc.
- `type` field distinguishes: "WeaponGun", "Shield", "Armor", "Paint", etc.

**Ship Components** (2,853 subset):
- Items where `type` is ship-related (coolers, shields, power plants, etc.)
- Can be equipped in vehicle hardpoints

**Relationship**: Ships → Hardpoints → Items (many-to-many through hardpoints junction)

---

## Entity Relationships

### Core Foreign Keys

| Child | Parent | Relationship | FK Field |
|-------|--------|--------------|----------|
| Vehicles | Manufacturers | Many-to-One | `manufacturer_uuid` |
| Items | Manufacturers | Many-to-One | `manufacturer_uuid` |
| Hardpoints | Items | Many-to-One | `item.uuid` |
| Celestial Objects | Star Systems | Many-to-One | `star_system_uuid` |
| Moons | Planets | Many-to-One | `parent_uuid` |

### Many-to-Many Relationships

**Ships ↔ Loaners** (self-referencing):
```
Vehicle A (Carrack) includes loaners: [Pisces, Ursa Rover]
```
- Requires junction table: `vehicle_loaners(vehicle_uuid, loaner_uuid)`

**Ships ↔ Items** (via hardpoints):
```
Vehicle → Hardpoints → Items
```
- Hardpoints table acts as junction with additional metadata (slot name, category, equipped item)

**Shops ↔ Items**:
```
Shop A sells: [Item 1, Item 2, Item 3]
Item 1 sold at: [Shop A, Shop B]
```
- Requires junction: `shop_inventory(shop_uuid, item_uuid, price, quantity)`

### Recursive Hierarchies

**Hardpoints**:
- `hardpoints` table with `parent_hardpoint_uuid` self-referencing FK
- Depth up to 13 levels

**Celestial Objects**:
- Star Systems → Planets → Moons → Stations
- `parent_uuid` self-referencing FK

---

## Data Volumes

### Current Counts (Feb 2026)

| Category | Count | Avg Size | Total Size |
|----------|-------|----------|------------|
| Vehicles | 288 | 50 KB | 14 MB |
| Items | 19,288 | 3 KB | 58 MB |
| Manufacturers | 124 | 2 KB | 248 KB |
| Celestial Objects | 877 | 4 KB | 3.5 MB |
| Galactapedia | 1,477 | 10 KB | 15 MB |
| Shops | ~300 | 5 KB | 1.5 MB |
| Commodities | ~150 | 2 KB | 300 KB |
| **Total** | **22,504** | - | **~90 MB** |

### Growth Rates (Historical)

**Vehicles**: 15-25 new ships per year (5-9% annual growth)

**Items**: 2,000-6,000 new items per year (10-30% growth)
- Major patches add 1,000+ items
- Minor patches add 100-500 items

**Galactapedia**: 200-400 articles per year

**Celestial Objects**: 50-100 per year (new systems added)

### 5-Year Projection (2026-2031)

| Category | Current | 2031 Estimate | Growth |
|----------|---------|---------------|--------|
| Vehicles | 288 | ~400 | +112 |
| Items | 19,288 | ~40,000 | +20,712 |
| Celestial Objects | 877 | ~1,300 | +423 |
| Galactapedia | 1,477 | ~3,500 | +2,023 |
| **Total DB Size** | 90 MB | **~185 MB** | +105% |

**Assumption**: Growth slows as game approaches "release" (100 star systems target)

---

## Rate Limits & Sync Strategy

### Rate Limiting

**Tested**: 50 parallel requests with no rate limit errors

**No authentication required**: Public read access

**No rate limit headers**: Neither `X-RateLimit-*` nor `Retry-After` observed

**Cloudflare protection**: DDoS protection present but no rate limiting detected

**Conclusion**: No practical rate limits for reasonable sync operations

### Cache Behavior

**Cloudflare CDN**: 12-hour cache TTL

**Cache headers**:
```
Cache-Control: public, max-age=43200
Age: 3456
CF-Cache-Status: HIT
```

**Implication**: Data freshness up to 12 hours stale during cache window

**Cache bypass**: Not needed for nightly sync (data updates daily at most)

### Conditional Requests

**Support confirmed**: `If-Modified-Since` / `Last-Modified` headers work

**Example**:
```
Request: If-Modified-Since: Wed, 12 Feb 2026 10:00:00 GMT
Response: 304 Not Modified (if unchanged)
```

**Bandwidth savings**: 304 responses are tiny (~200 bytes vs 5-680 KB)

**Sync optimization**: Only download changed resources

### Update Frequency (by category)

| Category | Update Frequency | Source |
|----------|------------------|--------|
| Vehicles | Daily | `/stats/latest` |
| Items | Daily | `/stats/latest` |
| Galactapedia | Weekly | Observed timestamps |
| Celestial Objects | Monthly | Rarely change mid-patch |
| Manufacturers | Quarterly | Very stable |

**Live data**: Shop prices and commodity values update hourly (not in scope for nightly sync)

### Recommended Sync Strategy

**Full sync estimate** (first run):
- 167 API requests (all categories, paginated)
- ~90 MB download
- ~3 minutes at 1 req/sec (conservative)
- ~30 seconds at 5 req/sec (aggressive but safe)

**Incremental sync** (nightly):
- Use `If-Modified-Since` for all resources
- Expect 5-15% changed daily (8-25 requests result in data)
- ~5-10 MB download
- ~30 seconds total

**Proposed schedule**:
- **Nightly at 3 AM** (same as current FleetYards sync)
- Full sync weekly (Sunday) to catch missed updates
- Incremental sync Mon-Sat

**Error handling**:
- Retry failed requests with exponential backoff
- Continue sync on individual failures (don't abort entire sync)
- Log failures for manual review

---

## Alternative Data Sources

### 1. starcitizen.tools (Semantic MediaWiki)

**Base URL**: `https://starcitizen.tools/api.php`

**Format**: MediaWiki API (XML/JSON)

**Content**: 369 semantic properties, community-edited

**Advantages**:
- Richer lore content
- Historical version tracking
- Community corrections

**Disadvantages**:
- Slower API (MediaWiki overhead)
- Less structured data
- Requires SMW query parsing

**Conclusion**: Good for lore/galactapedia, poor for ship stats

### 2. scunpacked-data (GitHub Repo)

**Repo**: `https://github.com/scunpacked/scunpacked-data`

**Format**: JSON files extracted from game client

**Content**: Raw game data files (DataForge P4K extracts)

**Update frequency**: Within hours of live patch

**Advantages**:
- Most up-to-date (reflects live game immediately)
- Includes hidden/unreleased items
- No API rate limits (git clone)

**Disadvantages**:
- No API (must clone 500 MB+ repo)
- Data structure changes with game patches (brittle)
- Includes WIP/unreleased content (noise)

**Conclusion**: Useful for validation, impractical for primary source

### 3. Other APIs

**starcitizen-api.com**: Deprecated (shut down 2024)

**UEX API**: Trade/commodity focus (not ship stats)

**FleetYards API**: Current data source (good for ships, lacks items/lore)

**Conclusion**: star-citizen.wiki API is most comprehensive for our use case

---

## Data Quality Observations

### Completeness

**Vehicles**: 95%+ complete (all flight-ready + announced concept ships)

**Items**: ~70% complete (many decorations/paints missing descriptions)

**Galactapedia**: ~60% complete (1,477 articles, target ~3,000+)

**Celestial Objects**: 90%+ complete (Stanton + Pyro systems well-documented)

### Accuracy

**Cross-checked** against:
- FleetYards API (ship stats match 95%+)
- scunpacked-data (component stats match 90%+)
- Official RSI website (production status accurate)

**Discrepancies**:
- Hardpoint loadouts sometimes differ from live game (balance patches)
- Item prices lag behind in-game changes (not in scope)
- WIP ships have placeholder stats

**Conclusion**: Accurate enough for fleet management use case

### Maintenance

**Update cadence**: Daily via automated sync from scunpacked-data

**Manual curation**: Yes (descriptions, images, classifications)

**Version tracking**: Game version field present on all entities

**Historical data**: Not preserved (current version only)

---

## Summary

### Endpoints
60+ endpoints across 12 major categories:
- Vehicles (ships + ground)
- Items (components, weapons, armor, etc.)
- Manufacturers
- Celestial objects (star systems, planets, moons, stations)
- Galactapedia
- Shops & commodities
- Game versions
- Stats & metadata

### Payloads
- **Vehicles**: 5-680 KB (hardpoints dominate large ships)
- **Items**: 2-9 KB (consistent size)
- **Nesting depth**: Up to 13 levels (recursive hardpoints)
- **Total data**: ~90 MB current, ~185 MB projected (2031)

### Relationships
- **Many-to-one**: Ships→Manufacturers, Items→Manufacturers, Moons→Planets
- **Many-to-many**: Ships↔Loaners (junction), Ships↔Items (via hardpoints), Shops↔Items
- **Recursive**: Hardpoints (children), Celestial Objects (parent)

### Sync Strategy
- **No rate limits** detected
- **Conditional requests** supported (If-Modified-Since)
- **Full sync**: ~3 minutes, 167 requests, 90 MB
- **Incremental sync**: ~30 seconds, 8-25 requests, 5-10 MB
- **Recommended**: Nightly at 3 AM, full sync weekly

### Database Implications
- Normalize core entities (vehicles, items, manufacturers, celestial objects)
- Junction tables for many-to-many (loaners, shop inventory)
- Hardpoints table with self-referencing FK for recursive nesting
- Consider denormalizing large nested payloads (hardpoints) for read performance
- Game version tracking for historical queries
- ~90 MB SQLite database (current), ~185 MB (5-year projection)

---

## Sources

- [Star Citizen Wiki API](https://api.star-citizen.wiki/api/)
- [OpenAPI Documentation](https://api.star-citizen.wiki/docs/openapi)
- [scunpacked-data GitHub](https://github.com/scunpacked/scunpacked-data)
- [starcitizen.tools SMW](https://starcitizen.tools/)
- [FleetYards API](https://fleetyards.net/api-docs)
- Direct API testing (50+ requests across all endpoint categories)
- Payload size measurements (Polaris, Carrack, Pisces, various items)
