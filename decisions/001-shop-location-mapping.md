# 001: Denormalize shop locations into location_label column

## Metadata

- **domain**: architecture
- **status**: decided
- **confidence**: high

## Context

Shops in D1 had `location_id` FK to `star_map_locations`, but it was 100% NULL. Investigation
of p4k data found two separate shop systems: LayerBackups.xml (modern, has location placement
via SuperName hierarchy) and ShopInventories (legacy, has prices/inventory). Our `shops` table
uses ShopInventories UUIDs; LayerBackups uses completely different UUIDs. Of 87 shops, 55 could
be mapped to star_map_locations via name matching through LayerBackups, but 32 could not because
they are template shops (rest stops, outposts) or reference removed locations (Port Olisar).

## Decision

Add a denormalized `location_label TEXT` column to the `shops` table instead of relying solely
on the `location_id` FK. Populate it with human-readable labels for all 87 shops.

## Rationale

Three categories of unmapped shops make a pure FK approach insufficient:

1. **Rest stop template shops (20)**: Shops like `R&R_Weapons` exist at every rest stop in the
   game via template instantiation. They don't map to a single `star_map_locations` row. Labeled
   as "All Rest Stops".

2. **Port Olisar shops (9)**: Port Olisar was removed from the game in Alpha 4.0 but its shop
   definitions remain in data files. Labeled as "Port Olisar (Removed)" — displayed with
   strikethrough styling in the UI.

3. **Outpost template shops (3)**: Small base/outpost shops that are template-instantiated across
   multiple outposts. Labeled as "Outposts".

A denormalized label handles all three cases cleanly without inventing fake star_map_locations
rows or building a complex many-to-many mapping for template shops.

## Alternatives Considered

### FK-only approach (location_id → star_map_locations)
- **Pros**: Normalized, referential integrity
- **Cons**: Cannot represent "All Rest Stops" or template shops; 32 shops would remain NULL
- **Why not**: Incomplete — doesn't solve the template shop problem

### Many-to-many shop_locations junction table
- **Pros**: Could map template shops to all their instantiated locations
- **Cons**: We don't have the instance-level data from p4k (LayerBackups only shows templates,
  not which rest stops they're instantiated at); over-engineered for the display need
- **Why not**: Data doesn't exist to populate it fully. The junction table `shop_locations`
  (migration 0068) was created for the 55 directly-mappable shops but doesn't cover templates.

### Create synthetic star_map_locations rows
- **Pros**: Keeps everything normalized
- **Cons**: Pollutes the star_map table with non-real locations; confusing for other queries
- **Why not**: Violates the principle that star_map_locations represents real in-game places

## Consequences

### Enables
- All 87 shops display a location in the UI
- Port Olisar shops are clearly marked as removed (strikethrough styling)
- Template shops show their scope (All Rest Stops, Outposts)
- No JOIN needed for shop queries — simpler, faster

### Constrains
- Location label is denormalized — if a star_map_location name changes, the shop label won't
  auto-update (acceptable: location names are stable game data)
- Template shop labels are approximate ("All Rest Stops" doesn't list which specific ones)

## Revisit Trigger

Reopen this decision if:
- CIG publishes instance-level shop placement data (which rest stop has which shop variant)
- The star_map_locations table grows to include rest stop instances individually
- Shop location data needs to be queryable/filterable by specific star system or planet

If none of these conditions are met, the decision stands.

## Evidence

- p4k LayerBackups.xml analysis: `docs/research/p4k-game-data-structures.md`
- Extraction script: `/home/gavin/scbridge/tools/scripts/shop_locations/extract.py`
- Migration 0068: `src/db/migrations/0068_shop_locations.sql` (junction table for 55 direct mappings)
- Migration applied via `wrangler d1 execute` for the `location_label` column + UPDATE statements
- Confidence: code (directly observed in p4k data and verified in D1)
