import { Hono } from "hono"
import type { HonoEnv } from "../lib/types"

const DEFAULT_VERSION_SUBQUERY = "(SELECT id FROM game_versions WHERE is_default = 1)"

/** SQL expression for shop display name — populated by extraction scripts */
const SHOP_DISPLAY_NAME_EXPR = `COALESCE(s.display_name, REPLACE(REPLACE(REPLACE(s.name, 'Inv ', ''), '_', ' '), '  ', ' '))`

/**
 * /api/gamedata — Public reference data for careers, reputation, law, mining, shops
 */
export function gamedataRoutes<E extends HonoEnv>() {
  const app = new Hono<E>()

  // GET /api/gamedata/careers — vehicle careers + roles with linked vehicles
  app.get("/careers", async (c) => {
    const db = c.env.DB

    const [careersResult, rolesResult, careerAssignments, roleAssignments] = await Promise.all([
      db.prepare("SELECT * FROM vehicle_careers WHERE name != '<= PLACEHOLDER =>' ORDER BY name").all(),
      db.prepare("SELECT * FROM vehicle_roles WHERE name != '<= PLACEHOLDER =>' AND name NOT LIKE '%Haymaker%' ORDER BY name").all(),
      db.prepare(`
        SELECT vca.career_id, v.id, v.name, v.slug, v.image_url, m.name as manufacturer_name, v.size_label, v.focus, v.classification
        FROM vehicle_career_assignments vca
        JOIN vehicles v ON v.id = vca.vehicle_id
        LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
        ORDER BY v.name
      `).all(),
      db.prepare(`
        SELECT vra.role_id, v.id, v.name, v.slug, v.image_url, m.name as manufacturer_name, v.size_label, v.focus, v.classification
        FROM vehicle_role_assignments vra
        JOIN vehicles v ON v.id = vra.vehicle_id
        LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
        ORDER BY v.name
      `).all(),
    ])

    // Nest vehicles under their career/role
    const vehiclesByCareer = new Map<number, any[]>()
    for (const v of careerAssignments.results) {
      const careerId = v.career_id as number
      if (!vehiclesByCareer.has(careerId)) vehiclesByCareer.set(careerId, [])
      vehiclesByCareer.get(careerId)!.push(v)
    }

    const vehiclesByRole = new Map<number, any[]>()
    for (const v of roleAssignments.results) {
      const roleId = v.role_id as number
      if (!vehiclesByRole.has(roleId)) vehiclesByRole.set(roleId, [])
      vehiclesByRole.get(roleId)!.push(v)
    }

    const careers = careersResult.results.map((career) => ({
      ...career,
      vehicles: vehiclesByCareer.get(career.id as number) ?? [],
      vehicle_count: (vehiclesByCareer.get(career.id as number) ?? []).length,
    }))

    const roles = rolesResult.results.map((role) => ({
      ...role,
      vehicles: vehiclesByRole.get(role.id as number) ?? [],
      vehicle_count: (vehiclesByRole.get(role.id as number) ?? []).length,
    }))

    return c.json({ careers, roles })
  })

  // GET /api/gamedata/reputation — reputation scopes with nested standings
  app.get("/reputation", async (c) => {
    const db = c.env.DB

    const { results: scopes } = await db
      .prepare(
        `SELECT * FROM reputation_scopes
         WHERE game_version_id = ${DEFAULT_VERSION_SUBQUERY}
           AND name NOT LIKE '%PLACEHOLDER%'
         ORDER BY name`,
      )
      .all()

    const { results: standings } = await db
      .prepare(
        `SELECT rs.*, rsc.name as scope_name, rsc.uuid as scope_uuid
         FROM reputation_standings rs
         JOIN reputation_scopes rsc ON rsc.id = rs.scope_id
         WHERE rs.game_version_id = ${DEFAULT_VERSION_SUBQUERY}
           AND rs.name != '<= PLACEHOLDER =>'
         ORDER BY rs.scope_id, rs.sort_order`,
      )
      .all()

    const { results: factionLinks } = await db
      .prepare(
        `SELECT frs.reputation_scope_id, frs.is_primary, f.id as faction_id, f.name as faction_name, f.slug as faction_slug
         FROM faction_reputation_scopes frs
         JOIN factions f ON f.id = frs.faction_id
         WHERE frs.game_version_id = ${DEFAULT_VERSION_SUBQUERY}
         ORDER BY frs.is_primary DESC, f.name`,
      )
      .all()

    // Nest standings under their parent scope
    const standingsByScope = new Map<number, typeof standings>()
    for (const s of standings) {
      const scopeId = s.scope_id as number
      if (!standingsByScope.has(scopeId)) standingsByScope.set(scopeId, [])
      standingsByScope.get(scopeId)!.push(s)
    }

    const factionsByScope = new Map<number, typeof factionLinks>()
    for (const fl of factionLinks) {
      const scopeId = fl.reputation_scope_id as number
      if (!factionsByScope.has(scopeId)) factionsByScope.set(scopeId, [])
      factionsByScope.get(scopeId)!.push(fl)
    }

    const scopesWithStandings = scopes.map((scope) => ({
      ...scope,
      standings: standingsByScope.get(scope.id as number) ?? [],
      factions: factionsByScope.get(scope.id as number) ?? [],
    }))

    return c.json({ scopes: scopesWithStandings })
  })

  // GET /api/gamedata/law — infractions, jurisdictions, overrides
  app.get("/law", async (c) => {
    const db = c.env.DB

    const [infractions, jurisdictions, overrides] = await Promise.all([
      db
        .prepare(
          `SELECT *, stats_json FROM law_infractions
           WHERE game_version_id = ${DEFAULT_VERSION_SUBQUERY}
           ORDER BY name`,
        )
        .all(),
      db
        .prepare(
          `SELECT *, prohibited_goods_json, controlled_substances_json FROM law_jurisdictions
           WHERE game_version_id = ${DEFAULT_VERSION_SUBQUERY}
           ORDER BY name`,
        )
        .all(),
      db
        .prepare(
          `SELECT jio.*,
             li.name as infraction_name,
             lj.name as jurisdiction_name,
             li.description as infraction_description,
             li.severity as infraction_severity,
             jio.overrides_json
           FROM jurisdiction_infraction_overrides jio
           JOIN law_infractions li ON li.id = jio.infraction_id
           JOIN law_jurisdictions lj ON lj.id = jio.jurisdiction_id
           WHERE jio.game_version_id = ${DEFAULT_VERSION_SUBQUERY}`,
        )
        .all(),
    ])

    return c.json({
      infractions: infractions.results,
      jurisdictions: jurisdictions.results,
      overrides: overrides.results,
    })
  })

  // GET /api/gamedata/mining — elements, compositions, refining processes
  app.get("/mining", async (c) => {
    const db = c.env.DB

    const [elements, compositions, refining] = await Promise.all([
      db
        .prepare(
          `SELECT * FROM mineable_elements
           WHERE game_version_id = ${DEFAULT_VERSION_SUBQUERY}
           ORDER BY name`,
        )
        .all(),
      db
        .prepare(
          `SELECT * FROM rock_compositions
           WHERE game_version_id = ${DEFAULT_VERSION_SUBQUERY}
           ORDER BY name`,
        )
        .all(),
      db
        .prepare(
          `SELECT * FROM refining_processes
           WHERE game_version_id = ${DEFAULT_VERSION_SUBQUERY}
           ORDER BY name`,
        )
        .all(),
    ])

    return c.json({
      elements: elements.results,
      compositions: compositions.results,
      refining: refining.results,
    })
  })

  // GET /api/gamedata/shops — shop list with item counts
  app.get("/shops", async (c) => {
    const db = c.env.DB

    const { results } = await db
      .prepare(
        `SELECT s.*,
           ${SHOP_DISPLAY_NAME_EXPR} as display_name,
           (SELECT COUNT(*) FROM shop_inventory si WHERE si.shop_id = s.id) as item_count,
           s.location_label as location_name
         FROM shops s
         WHERE s.game_version_id = ${DEFAULT_VERSION_SUBQUERY}
         ORDER BY s.name`,
      )
      .all()

    return c.json(results)
  })

  // GET /api/gamedata/shops/:slug/inventory — inventory for a specific shop
  app.get("/shops/:slug/inventory", async (c) => {
    const slug = c.req.param("slug")
    const db = c.env.DB

    const { results } = await db
      .prepare(
        `SELECT si.*,
           COALESCE(fi.name, v.name, si.item_name) as resolved_name
         FROM shop_inventory si
         LEFT JOIN loot_map fi ON fi.uuid = si.item_uuid AND fi.game_version_id = ${DEFAULT_VERSION_SUBQUERY}
         LEFT JOIN vehicles v ON v.uuid = si.item_uuid
         JOIN shops s ON s.id = si.shop_id
         WHERE s.slug = ?
           AND s.game_version_id = ${DEFAULT_VERSION_SUBQUERY}
         ORDER BY COALESCE(fi.name, v.name, si.item_name), si.buy_price DESC`,
      )
      .bind(slug)
      .all()

    return c.json(results)
  })

  // GET /api/gamedata/trade — trade commodities with per-shop buy/sell/stock data
  app.get("/trade", async (c) => {
    const db = c.env.DB

    const [commoditiesResult, listingsResult] = await Promise.all([
      db
        .prepare(
          `SELECT * FROM trade_commodities
           WHERE game_version_id = ${DEFAULT_VERSION_SUBQUERY}
           ORDER BY category, name`,
        )
        .all(),
      db
        .prepare(
          `SELECT si.item_uuid, si.buy_price, si.sell_price,
             si.base_inventory, si.max_inventory,
             s.name as shop_name, s.slug as shop_slug,
             ${SHOP_DISPLAY_NAME_EXPR} as shop_display_name,
             s.location_label
           FROM shop_inventory si
           JOIN shops s ON s.id = si.shop_id
           JOIN trade_commodities tc ON tc.uuid = si.item_uuid
           WHERE s.shop_type = 'admin'
             AND s.game_version_id = ${DEFAULT_VERSION_SUBQUERY}
           ORDER BY s.location_label, s.name`,
        )
        .all(),
    ])

    // Nest listings under their commodity UUID
    const listingsByUuid = new Map<string, any[]>()
    for (const l of listingsResult.results) {
      const uuid = l.item_uuid as string
      if (!listingsByUuid.has(uuid)) listingsByUuid.set(uuid, [])
      listingsByUuid.get(uuid)!.push(l)
    }

    const commodities = commoditiesResult.results.map((c) => ({
      ...c,
      listings: listingsByUuid.get(c.uuid as string) ?? [],
    }))

    // Unique locations for filter UI
    const locations = [
      ...new Set(
        listingsResult.results
          .map((l) => l.location_label as string)
          .filter(Boolean),
      ),
    ].sort()

    return c.json({ commodities, locations })
  })

  // GET /api/gamedata/locations/:slug/shops — shops at a location with inventory
  app.get("/locations/:slug/shops", async (c) => {
    const slug = c.req.param("slug")
    const db = c.env.DB

    // Find the location by slug
    const location = await db
      .prepare(
        `SELECT id, name, slug, location_type
         FROM star_map_locations
         WHERE slug = ?
           AND game_version_id = ${DEFAULT_VERSION_SUBQUERY}
         LIMIT 1`,
      )
      .bind(slug)
      .first()

    if (!location) {
      return c.json({ location: null, shops: [] })
    }

    // Find all child location IDs (outposts on a moon/planet) + the location itself
    const { results: childLocations } = await db
      .prepare(
        `SELECT id FROM star_map_locations
         WHERE (id = ? OR parent_uuid = (
           SELECT uuid FROM star_map_locations WHERE id = ? AND game_version_id = ${DEFAULT_VERSION_SUBQUERY}
         ))
         AND game_version_id = ${DEFAULT_VERSION_SUBQUERY}`,
      )
      .bind(location.id, location.id)
      .all()

    const locationIds = childLocations.map((r) => r.id as number)
    if (locationIds.length === 0) {
      return c.json({ location, shops: [] })
    }

    // Find shops at these locations via shop_locations junction
    const placeholders = locationIds.map(() => "?").join(",")
    const { results: shops } = await db
      .prepare(
        `SELECT DISTINCT s.id, s.name, s.slug, s.shop_type, s.location_label,
           sl.placement_name
         FROM shops s
         JOIN shop_locations sl ON sl.shop_id = s.id
         WHERE sl.location_id IN (${placeholders})
           AND s.game_version_id = ${DEFAULT_VERSION_SUBQUERY}
         ORDER BY s.shop_type, s.name`,
      )
      .bind(...locationIds)
      .all()

    if (shops.length === 0) {
      // Also try shops.location_id directly (legacy column)
      const { results: directShops } = await db
        .prepare(
          `SELECT s.id, s.name, s.slug, s.shop_type, s.location_label, NULL as placement_name
           FROM shops s
           WHERE s.location_id IN (${placeholders})
             AND s.game_version_id = ${DEFAULT_VERSION_SUBQUERY}
           ORDER BY s.shop_type, s.name`,
        )
        .bind(...locationIds)
        .all()

      if (directShops.length === 0) {
        return c.json({ location, shops: [] })
      }

      // Fetch inventory for direct shops
      const directShopIds = directShops.map((s) => s.id as number)
      const invPlaceholders = directShopIds.map(() => "?").join(",")
      const { results: inventory } = await db
        .prepare(
          `SELECT si.shop_id, si.item_uuid, si.item_name, si.buy_price, si.sell_price,
             si.base_inventory, si.max_inventory,
             COALESCE(fi.name, tc.name, v.name, si.item_name) as resolved_name,
             CASE
               WHEN fi.id IS NOT NULL THEN 'gear'
               WHEN tc.id IS NOT NULL THEN 'commodity'
               WHEN v.id IS NOT NULL THEN 'vehicle'
               ELSE 'other'
             END as item_category
           FROM shop_inventory si
           LEFT JOIN loot_map fi ON fi.uuid = si.item_uuid AND fi.game_version_id = ${DEFAULT_VERSION_SUBQUERY}
           LEFT JOIN trade_commodities tc ON tc.uuid = si.item_uuid
           LEFT JOIN vehicles v ON v.uuid = si.item_uuid
           WHERE si.shop_id IN (${invPlaceholders})
             AND si.game_version_id = ${DEFAULT_VERSION_SUBQUERY}
           ORDER BY COALESCE(fi.name, tc.name, v.name, si.item_name)`,
        )
        .bind(...directShopIds)
        .all()

      const inventoryByShop = new Map<number, typeof inventory>()
      for (const item of inventory) {
        const shopId = item.shop_id as number
        if (!inventoryByShop.has(shopId)) inventoryByShop.set(shopId, [])
        inventoryByShop.get(shopId)!.push(item)
      }

      const shopsWithItems = directShops.map((shop) => ({
        ...shop,
        displayName:
          (shop.name as string)
            .replace(/^Inv /, "")
            .replace(/_/g, " ")
            .replace(/  +/g, " ")
            .trim(),
        items: inventoryByShop.get(shop.id as number) ?? [],
      }))

      return c.json({ location, shops: shopsWithItems })
    }

    // Fetch inventory for all matched shops
    const shopIds = shops.map((s) => s.id as number)
    const invPlaceholders = shopIds.map(() => "?").join(",")
    const { results: inventory } = await db
      .prepare(
        `SELECT si.shop_id, si.item_uuid, si.item_name, si.buy_price, si.sell_price,
           si.base_inventory, si.max_inventory,
           COALESCE(fi.name, tc.name, v.name, si.item_name) as resolved_name,
           CASE
             WHEN fi.id IS NOT NULL THEN 'gear'
             WHEN tc.id IS NOT NULL THEN 'commodity'
             WHEN v.id IS NOT NULL THEN 'vehicle'
             ELSE 'other'
           END as item_category
         FROM shop_inventory si
         LEFT JOIN loot_map fi ON fi.uuid = si.item_uuid AND fi.game_version_id = ${DEFAULT_VERSION_SUBQUERY}
         LEFT JOIN trade_commodities tc ON tc.uuid = si.item_uuid
         LEFT JOIN vehicles v ON v.uuid = si.item_uuid
         WHERE si.shop_id IN (${invPlaceholders})
           AND si.game_version_id = ${DEFAULT_VERSION_SUBQUERY}
         ORDER BY COALESCE(fi.name, tc.name, v.name, si.item_name)`,
      )
      .bind(...shopIds)
      .all()

    // Nest inventory under shops
    const inventoryByShop = new Map<number, typeof inventory>()
    for (const item of inventory) {
      const shopId = item.shop_id as number
      if (!inventoryByShop.has(shopId)) inventoryByShop.set(shopId, [])
      inventoryByShop.get(shopId)!.push(item)
    }

    const shopsWithItems = shops.map((shop) => ({
      ...shop,
      displayName:
        (shop.name as string)
          .replace(/^Inv /, "")
          .replace(/_/g, " ")
          .replace(/  +/g, " ")
          .trim(),
      items: inventoryByShop.get(shop.id as number) ?? [],
    }))

    return c.json({ location, shops: shopsWithItems })
  })

  // GET /api/gamedata/missions — mission types + givers with faction/location data
  app.get("/missions", async (c) => {
    const db = c.env.DB

    const [typesResult, giversResult] = await Promise.all([
      db.prepare(
        `SELECT * FROM mission_types
         WHERE game_version_id = ${DEFAULT_VERSION_SUBQUERY}
           AND name != '<= PLACEHOLDER =>'
         ORDER BY name`,
      ).all(),
      db.prepare(
        `SELECT mg.*,
           f.name as faction_name, f.slug as faction_slug,
           sml.name as location_name
         FROM mission_givers mg
         LEFT JOIN factions f ON f.id = mg.faction_id
         LEFT JOIN star_map_locations sml ON sml.id = mg.location_id
         WHERE mg.game_version_id = ${DEFAULT_VERSION_SUBQUERY}
           AND mg.name != '<= PLACEHOLDER =>'
           AND mg.name != '<= UNINITIALIZED =>'
         ORDER BY mg.name`,
      ).all(),
    ])

    return c.json({
      types: typesResult.results,
      givers: giversResult.results,
    })
  })

  return app
}
