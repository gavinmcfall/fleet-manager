import { Hono } from "hono"
import type { HonoEnv } from "../lib/types"
import { cachedJson, resolveVersionId, cacheSlug } from "../lib/cache"
import { deltaVersionJoin, deltaVersionId } from "../lib/constants"

const DEFAULT_VERSION_SUBQUERY = "(SELECT id FROM game_versions WHERE is_default = 1)"

/** Version-aware subquery — uses resolved versionId when available */
function versionSub(versionId: number): string {
  return versionId > 0 ? String(versionId) : DEFAULT_VERSION_SUBQUERY
}

/** SQL expression for shop display name — populated by extraction scripts */
const SHOP_DISPLAY_NAME_EXPR = `COALESCE(s.display_name, REPLACE(REPLACE(REPLACE(s.name, 'Inv ', ''), '_', ' '), '  ', ' '))`

/** Build the inventory query for a set of shop IDs */
function buildInventoryQuery(placeholders: string, versionId: number = -1): string {
  return `SELECT si.shop_id, si.item_uuid, si.item_name, si.buy_price, si.sell_price,
       si.base_inventory, si.max_inventory,
       COALESCE(fi.name, tc.name, v.name, si.item_name) as resolved_name,
       CASE
         WHEN fi.id IS NOT NULL THEN 'gear'
         WHEN tc.id IS NOT NULL THEN 'commodity'
         WHEN v.id IS NOT NULL THEN 'vehicle'
         ELSE 'other'
       END as item_category
     FROM shop_inventory si
     LEFT JOIN loot_map fi ON fi.uuid = si.item_uuid AND fi.game_version_id = ${deltaVersionId("loot_map", versionId)}
     LEFT JOIN trade_commodities tc ON tc.uuid = si.item_uuid
     LEFT JOIN vehicles v ON v.uuid = si.item_uuid
     WHERE si.shop_id IN (${placeholders})
       AND si.game_version_id = ${deltaVersionId("shop_inventory", versionId)}
     ORDER BY COALESCE(fi.name, tc.name, v.name, si.item_name)`
}

/** Nest inventory items under their shops with cleaned display names */
function nestInventoryUnderShops(
  shops: Record<string, unknown>[],
  inventory: Record<string, unknown>[],
): Record<string, unknown>[] {
  const inventoryByShop = new Map<number, Record<string, unknown>[]>()
  for (const item of inventory) {
    const shopId = item.shop_id as number
    if (!inventoryByShop.has(shopId)) inventoryByShop.set(shopId, [])
    inventoryByShop.get(shopId)!.push(item)
  }

  return shops.map((shop) => ({
    ...shop,
    displayName:
      (shop.name as string)
        .replace(/^Inv /, "")
        .replace(/_/g, " ")
        .replace(/  +/g, " ")
        .trim(),
    items: inventoryByShop.get(shop.id as number) ?? [],
  }))
}

/**
 * /api/gamedata — Public reference data for careers, reputation, law, mining, shops
 */
export function gamedataRoutes<E extends HonoEnv>() {
  const app = new Hono<E>()

  // GET /api/gamedata/careers — vehicle careers + roles with linked vehicles
  app.get("/careers", async (c) => {
    const db = c.env.DB
    const versionId = await resolveVersionId(db, c.req.query("patch"))
    return cachedJson(c, `gd:careers:${versionId}`, async () => {
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

      const vehiclesByCareer = new Map<number, Record<string, unknown>[]>()
      for (const v of careerAssignments.results) {
        const careerId = v.career_id as number
        if (!vehiclesByCareer.has(careerId)) vehiclesByCareer.set(careerId, [])
        vehiclesByCareer.get(careerId)!.push(v)
      }

      const vehiclesByRole = new Map<number, Record<string, unknown>[]>()
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

      return { careers, roles }
    })
  })

  // GET /api/gamedata/reputation — reputation scopes with nested standings
  app.get("/reputation", async (c) => {
    const db = c.env.DB
    const patch = c.req.query("patch")
    const versionId = await resolveVersionId(db, patch)
    return cachedJson(c, `gd:reputation:${versionId}`, async () => {
      const dvjScopes = deltaVersionJoin('reputation_scopes', 'rsc2', 'uuid', versionId)
      const dvjStandings = deltaVersionJoin('reputation_standings', 'rs', 'uuid', versionId)

      const { results: scopes } = await db
        .prepare(
          `SELECT rsc2.* FROM reputation_scopes rsc2
           ${dvjScopes}
           WHERE rsc2.name NOT LIKE '%PLACEHOLDER%'
           ORDER BY rsc2.name`,
        )
        .all()

      const { results: standings } = await db
        .prepare(
          `SELECT rs.*, rsc.name as scope_name, rsc.uuid as scope_uuid
           FROM reputation_standings rs
           ${dvjStandings}
           JOIN reputation_scopes rsc ON rsc.id = rs.scope_id
           WHERE rs.name != '<= PLACEHOLDER =>'
           ORDER BY rs.scope_id, rs.sort_order`,
        )
        .all()

      const { results: factionLinks } = await db
        .prepare(
          `SELECT frs.reputation_scope_id, frs.is_primary, f.id as faction_id, f.name as faction_name, f.slug as faction_slug
           FROM faction_reputation_scopes frs
           JOIN factions f ON f.id = frs.faction_id
           WHERE frs.game_version_id = ${deltaVersionId("faction_reputation_scopes", versionId)}
           ORDER BY frs.is_primary DESC, f.name`,
        )
        .all()

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

      return { scopes: scopesWithStandings }
    })
  })

  // GET /api/gamedata/law — infractions, jurisdictions, overrides
  app.get("/law", async (c) => {
    const db = c.env.DB
    const patch = c.req.query("patch")
    const versionId = await resolveVersionId(db, patch)
    return cachedJson(c, `gd:law:${versionId}`, async () => {
      const dvjInfractions = deltaVersionJoin('law_infractions', 'li2', 'uuid', versionId)
      const dvjJurisdictions = deltaVersionJoin('law_jurisdictions', 'lj2', 'uuid', versionId)

      const [infractions, jurisdictions, overrides] = await Promise.all([
        db
          .prepare(
            `SELECT li2.* FROM law_infractions li2
             ${dvjInfractions}
             ORDER BY li2.name`,
          )
          .all(),
        db
          .prepare(
            `SELECT lj2.* FROM law_jurisdictions lj2
             ${dvjJurisdictions}
             ORDER BY lj2.name`,
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
             WHERE jio.game_version_id = ${deltaVersionId("jurisdiction_infraction_overrides", versionId)}`,
          )
          .all(),
      ])

      return {
        infractions: infractions.results,
        jurisdictions: jurisdictions.results,
        overrides: overrides.results,
      }
    })
  })

  // GET /api/gamedata/mining — full mining data: elements, compositions, refining,
  // locations, deposits, quality distributions, clustering, equipment
  app.get("/mining", async (c) => {
    const db = c.env.DB
    const patch = c.req.query("patch")
    const versionId = await resolveVersionId(db, patch)
    return cachedJson(c, `gd:mining:${versionId}`, async () => {
      const dvjElements = deltaVersionJoin('mineable_elements', 'me', 'uuid', versionId)
      const dvjCompositions = deltaVersionJoin('rock_compositions', 'rc2', 'uuid', versionId)
      const dvjRefining = deltaVersionJoin('refining_processes', 'rp', 'uuid', versionId)
      const [
        elements,
        compositions,
        refining,
        locations,
        deposits,
        qualityDistributions,
        clusteringPresets,
        clusteringParams,
        lasers,
        modules,
        gadgets,
      ] = await Promise.all([
        db
          .prepare(
            `SELECT me.* FROM mineable_elements me
             ${dvjElements}
             WHERE me.name NOT LIKE '%Template%'
               AND me.name NOT LIKE '%Testelement%'
             ORDER BY me.name`,
          )
          .all(),
        db
          .prepare(
            `SELECT rc2.* FROM rock_compositions rc2
             ${dvjCompositions}
             ORDER BY rc2.name`,
          )
          .all(),
        db
          .prepare(
            `SELECT rp.* FROM refining_processes rp
             ${dvjRefining}
             ORDER BY rp.name`,
          )
          .all(),
        db
          .prepare(
            `SELECT * FROM mining_locations
             WHERE game_version_id = ${deltaVersionId("mining_locations", versionId)}
             ORDER BY system, name`,
          )
          .all(),
        db
          .prepare(
            `SELECT d.*, rc.id as rock_composition_id, rc.name as composition_name,
                    rc.rock_type, rc.composition_json
             FROM mining_location_deposits d
             JOIN mining_locations ml ON ml.id = d.mining_location_id
             LEFT JOIN rock_compositions rc ON rc.uuid = d.composition_guid
               AND rc.game_version_id = ${deltaVersionId("rock_compositions", versionId)}
             WHERE ml.game_version_id = ${deltaVersionId("mining_locations", versionId)}
             ORDER BY d.mining_location_id, d.group_name`,
          )
          .all(),
        db
          .prepare(
            `SELECT * FROM mining_quality_distributions
             WHERE game_version_id = ${deltaVersionId("mining_quality_distributions", versionId)}`,
          )
          .all(),
        db
          .prepare(
            `SELECT * FROM mining_clustering_presets
             WHERE game_version_id = ${deltaVersionId("mining_clustering_presets", versionId)}
             ORDER BY name`,
          )
          .all(),
        db
          .prepare(
            `SELECT mcp.* FROM mining_clustering_params mcp
             JOIN mining_clustering_presets p ON p.id = mcp.mining_clustering_preset_id
             WHERE p.game_version_id = ${deltaVersionId("mining_clustering_presets", versionId)}
             ORDER BY mcp.mining_clustering_preset_id, mcp.relative_probability DESC`,
          )
          .all(),
        db
          .prepare(
            `SELECT * FROM mining_lasers
             WHERE game_version_id = ${deltaVersionId("mining_lasers", versionId)}
             ORDER BY size, name`,
          )
          .all(),
        db
          .prepare(
            `SELECT * FROM mining_modules
             WHERE game_version_id = ${deltaVersionId("mining_modules", versionId)}
             ORDER BY type, size, name`,
          )
          .all(),
        db
          .prepare(
            `SELECT * FROM mining_gadgets
             WHERE game_version_id = ${deltaVersionId("mining_gadgets", versionId)}
             ORDER BY name`,
          )
          .all(),
      ])

      // Nest clustering params into their parent presets
      const paramsByPreset = new Map<number, typeof clusteringParams.results>()
      for (const p of clusteringParams.results) {
        const pid = p.mining_clustering_preset_id as number
        if (!paramsByPreset.has(pid)) paramsByPreset.set(pid, [])
        paramsByPreset.get(pid)!.push(p)
      }
      const presetsWithParams = clusteringPresets.results.map((preset) => ({
        ...preset,
        params: paramsByPreset.get(preset.id as number) || [],
      }))

      return {
        elements: elements.results,
        compositions: compositions.results,
        refining: refining.results,
        locations: locations.results,
        deposits: deposits.results,
        quality_distributions: qualityDistributions.results,
        clustering_presets: presetsWithParams,
        lasers: lasers.results,
        modules: modules.results,
        gadgets: gadgets.results,
      }
    })
  })

  // GET /api/gamedata/shops — shop list with item counts
  app.get("/shops", async (c) => {
    const db = c.env.DB
    const patch = c.req.query("patch")
    const versionId = await resolveVersionId(db, patch)
    const dvjShops = deltaVersionJoin('shops', 's', 'uuid', versionId)
    return cachedJson(c, `gd:shops:${versionId}`, async () => {
      const { results } = await db
        .prepare(
          `SELECT s.*,
             ${SHOP_DISPLAY_NAME_EXPR} as display_name,
             (SELECT COUNT(*) FROM shop_inventory si WHERE si.shop_id = s.id) as item_count,
             s.location_label as location_name
           FROM shops s
           ${dvjShops}
           ORDER BY s.name`,
        )
        .all()

      return results
    })
  })

  // GET /api/gamedata/shops/:slug/inventory — inventory for a specific shop
  app.get("/shops/:slug/inventory", async (c) => {
    const slug = c.req.param("slug")
    if (slug.length > 100) return c.json({ error: "Not found" }, 404)
    const db = c.env.DB
    const patch = c.req.query("patch")
    const versionId = await resolveVersionId(db, patch)
    const dvjShops = deltaVersionJoin('shops', 's', 'uuid', versionId)

    // Verify shop exists before caching (prevents cache pollution with fake slugs)
    const shop = await db
      .prepare(`SELECT s.id FROM shops s ${dvjShops} WHERE s.slug = ?`)
      .bind(slug)
      .first()
    if (!shop) return c.json({ error: "Not found" }, 404)

    return cachedJson(c, `gd:shop-inv:${versionId}:${cacheSlug(slug)}`, async () => {
      const { results } = await db
        .prepare(
          `SELECT si.*,
             COALESCE(fi.name, v.name, si.item_name) as resolved_name
           FROM shop_inventory si
           LEFT JOIN loot_map fi ON fi.uuid = si.item_uuid AND fi.game_version_id = ${deltaVersionId("loot_map", versionId)}
           LEFT JOIN vehicles v ON v.uuid = si.item_uuid
           JOIN shops s ON s.id = si.shop_id
           ${dvjShops}
           WHERE s.slug = ?
           ORDER BY COALESCE(fi.name, v.name, si.item_name), si.buy_price DESC`,
        )
        .bind(slug)
        .all()

      return results
    })
  })

  // GET /api/gamedata/trade — trade commodities with per-shop buy/sell/stock data
  app.get("/trade", async (c) => {
    const db = c.env.DB
    const patch = c.req.query("patch")
    const versionId = await resolveVersionId(db, patch)
    const dvjTrade = deltaVersionJoin('trade_commodities', 'tc2', 'uuid', versionId)
    const dvjShops = deltaVersionJoin('shops', 's', 'uuid', versionId)
    return cachedJson(c, `gd:trade:${versionId}`, async () => {
      const [commoditiesResult, listingsResult] = await Promise.all([
        db
          .prepare(
            `SELECT tc2.* FROM trade_commodities tc2
             ${dvjTrade}
             ORDER BY tc2.category, tc2.name`,
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
             ${dvjShops}
             JOIN trade_commodities tc ON tc.uuid = si.item_uuid AND tc.game_version_id = s.game_version_id
             WHERE s.shop_type = 'admin'
             ORDER BY s.location_label, s.name`,
          )
          .all(),
      ])

      const listingsByUuid = new Map<string, Record<string, unknown>[]>()
      for (const l of listingsResult.results) {
        const uuid = l.item_uuid as string
        if (!listingsByUuid.has(uuid)) listingsByUuid.set(uuid, [])
        listingsByUuid.get(uuid)!.push(l)
      }

      const commodities = commoditiesResult.results.map((comm) => ({
        ...comm,
        listings: listingsByUuid.get(comm.uuid as string) ?? [],
      }))

      const locations = [
        ...new Set(
          listingsResult.results
            .map((l) => l.location_label as string)
            .filter(Boolean),
        ),
      ].sort()

      return { commodities, locations }
    })
  })

  // GET /api/gamedata/locations/:slug/shops — shops at a location with inventory
  app.get("/locations/:slug/shops", async (c) => {
    const slug = c.req.param("slug")
    const db = c.env.DB
    const patch = c.req.query("patch")
    const versionId = await resolveVersionId(db, patch)
    const dvjLocations = deltaVersionJoin('star_map_locations', 'sml', 'uuid', versionId)
    const dvjShops = deltaVersionJoin('shops', 's', 'uuid', versionId)
    return cachedJson(c, `gd:loc-shops:${versionId}:${cacheSlug(slug)}`, async () => {
      const location = await db
        .prepare(
          `SELECT sml.id, sml.name, sml.slug, sml.location_type
           FROM star_map_locations sml
           ${dvjLocations}
           WHERE sml.slug = ?
           LIMIT 1`,
        )
        .bind(slug)
        .first()

      if (!location) {
        // Fallback: match slug against location_label on shops directly
        // (star_map_locations may not have a matching slug for common location names)
        const labelSlug = slug.replace(/-/g, ' ')
        const { results: labelShops } = await db
          .prepare(
            `SELECT s.id, s.name, s.slug, s.shop_type, s.location_label, NULL as placement_name
             FROM shops s
             ${dvjShops}
             WHERE LOWER(REPLACE(s.location_label, ' ', '')) = LOWER(REPLACE(?, ' ', ''))
             ORDER BY s.shop_type, s.name`,
          )
          .bind(labelSlug)
          .all()

        if (labelShops.length === 0) return { location: null, shops: [] }

        const labelShopIds = labelShops.map((s) => s.id as number)
        const labelPlaceholders = labelShopIds.map(() => "?").join(",")
        const { results: labelInv } = await db
          .prepare(buildInventoryQuery(labelPlaceholders, versionId))
          .bind(...labelShopIds)
          .all()

        return { location: { name: labelShops[0].location_label, slug }, shops: nestInventoryUnderShops(labelShops, labelInv) }
      }

      const dvjLocations2 = deltaVersionJoin('star_map_locations', 'sml2', 'uuid', versionId)
      const { results: childLocations } = await db
        .prepare(
          `SELECT sml2.id FROM star_map_locations sml2
           ${dvjLocations2}
           WHERE (sml2.id = ? OR sml2.parent_uuid = (
             SELECT sml3.uuid FROM star_map_locations sml3 WHERE sml3.id = ?
           ))`,
        )
        .bind(location.id, location.id)
        .all()

      const locationIds = childLocations.map((r) => r.id as number)
      if (locationIds.length === 0) {
        return { location, shops: [] }
      }

      const placeholders = locationIds.map(() => "?").join(",")
      const { results: shops } = await db
        .prepare(
          `SELECT DISTINCT s.id, s.name, s.slug, s.shop_type, s.location_label,
             sl.placement_name
           FROM shops s
           ${dvjShops}
           JOIN shop_locations sl ON sl.shop_id = s.id
           WHERE sl.location_id IN (${placeholders})
           ORDER BY s.shop_type, s.name`,
        )
        .bind(...locationIds)
        .all()

      if (shops.length === 0) {
        const { results: directShops } = await db
          .prepare(
            `SELECT s.id, s.name, s.slug, s.shop_type, s.location_label, NULL as placement_name
             FROM shops s
             ${dvjShops}
             WHERE s.location_id IN (${placeholders})
             ORDER BY s.shop_type, s.name`,
          )
          .bind(...locationIds)
          .all()

        if (directShops.length === 0) {
          return { location, shops: [] }
        }

        const directShopIds = directShops.map((s) => s.id as number)
        const invPlaceholders = directShopIds.map(() => "?").join(",")
        const { results: inventory } = await db
          .prepare(buildInventoryQuery(invPlaceholders, versionId))
          .bind(...directShopIds)
          .all()

        return { location, shops: nestInventoryUnderShops(directShops, inventory) }
      }

      const shopIds = shops.map((s) => s.id as number)
      const invPlaceholders = shopIds.map(() => "?").join(",")
      const { results: inventory } = await db
        .prepare(buildInventoryQuery(invPlaceholders, versionId))
        .bind(...shopIds)
        .all()

      return { location, shops: nestInventoryUnderShops(shops, inventory) }
    })
  })

  // GET /api/gamedata/weapon-racks — vehicle weapon racks grouped by vehicle
  app.get("/weapon-racks", async (c) => {
    const db = c.env.DB
    const patch = c.req.query("patch")
    const versionId = await resolveVersionId(db, patch)
    const dvjRacks = deltaVersionJoin('vehicle_weapon_racks', 'wr', 'uuid', versionId)
    return cachedJson(c, `gd:weapon-racks:${versionId}`, async () => {
      const { results } = await db
        .prepare(
          `SELECT wr.*, v.name as vehicle_name, v.slug as vehicle_slug,
             m.name as manufacturer_name, m.code as manufacturer_code
           FROM vehicle_weapon_racks wr
           ${dvjRacks}
           LEFT JOIN vehicles v ON v.id = wr.vehicle_id
           LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
           ORDER BY v.name, wr.rack_label`,
        )
        .all()
      return results
    })
  })

  // GET /api/gamedata/suit-lockers — vehicle suit lockers grouped by vehicle
  app.get("/suit-lockers", async (c) => {
    const db = c.env.DB
    const patch = c.req.query("patch")
    const versionId = await resolveVersionId(db, patch)
    const dvjLockers = deltaVersionJoin('vehicle_suit_lockers', 'sl', 'uuid', versionId)
    return cachedJson(c, `gd:suit-lockers:${versionId}`, async () => {
      const { results } = await db
        .prepare(
          `SELECT sl.*, v.name as vehicle_name, v.slug as vehicle_slug,
             m.name as manufacturer_name, m.code as manufacturer_code
           FROM vehicle_suit_lockers sl
           ${dvjLockers}
           LEFT JOIN vehicles v ON v.id = sl.vehicle_id
           LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
           ORDER BY v.name, sl.locker_label`,
        )
        .all()
      return results
    })
  })


  // GET /api/gamedata/npc-loadouts — list all factions with loadout counts
  app.get("/npc-loadouts", async (c) => {
    const db = c.env.DB
    const patch = c.req.query("patch")
    const versionId = await resolveVersionId(db, patch)
    const dvjLoadouts = deltaVersionJoin('npc_loadouts', 'nl', 'file_path', versionId)
    return cachedJson(c, `gd:npc-loadouts:${versionId}`, async () => {
      const { results: factions } = await db
        .prepare(
          `SELECT f.id, f.code, f.name,
             COUNT(nl.id) as loadout_count,
             SUM(nl.visible_item_count) as item_count
           FROM npc_factions f
           JOIN npc_loadouts nl ON nl.faction_id = f.id
           ${dvjLoadouts}
           WHERE nl.visible_item_count > 0
           GROUP BY f.id
           HAVING item_count > 0
           ORDER BY f.name`,
        )
        .all()
      return factions
    })
  })

  // GET /api/gamedata/npc-loadouts/:faction — paginated loadouts for a faction with nested items
  app.get("/npc-loadouts/:faction", async (c) => {
    const factionCode = c.req.param("faction")
    const page = Math.max(1, parseInt(c.req.query("page") || "1", 10) || 1)
    const perPage = Math.min(100, Math.max(1, parseInt(c.req.query("per_page") || "50", 10) || 50))
    const db = c.env.DB
    const patch = c.req.query("patch")
    const versionId = await resolveVersionId(db, patch)
    const dvjLoadouts = deltaVersionJoin('npc_loadouts', 'nl', 'file_path', versionId)
    return cachedJson(c, `gd:npc-loadout:${versionId}:${cacheSlug(factionCode)}:p${page}:pp${perPage}`, async () => {
      const faction = await db
        .prepare("SELECT * FROM npc_factions WHERE code = ? LIMIT 1")
        .bind(factionCode)
        .first()

      if (!faction) return null

      // Count total visible loadouts (those with at least one non-hidden item)
      const countRow = await db
        .prepare(
          `SELECT COUNT(*) as total FROM npc_loadouts nl
           ${dvjLoadouts}
           WHERE nl.faction_id = ?
             AND nl.visible_item_count > 0`,
        )
        .bind(faction.id)
        .first<{ total: number }>()

      const totalLoadouts = countRow?.total ?? 0
      const totalPages = Math.ceil(totalLoadouts / perPage)
      const offset = (page - 1) * perPage

      // Fetch paginated loadouts — only those with visible items
      const { results: loadouts } = await db
        .prepare(
          `SELECT nl.*
           FROM npc_loadouts nl
           ${dvjLoadouts}
           WHERE nl.faction_id = ?
             AND nl.visible_item_count > 0
           ORDER BY nl.category, nl.sub_category, nl.loadout_name
           LIMIT ? OFFSET ?`,
        )
        .bind(faction.id, perPage, offset)
        .all()

      let items: Record<string, unknown>[] = []

      if (loadouts.length > 0) {
        // Build placeholders for the current page's loadout IDs
        const loadoutIds = loadouts.map((l) => l.id as number)
        const placeholders = loadoutIds.map(() => "?").join(",")
        const { results } = await db
          .prepare(
            `SELECT nli.*, nli.loot_map_uuid as loot_uuid
             FROM npc_loadout_items nli
             WHERE nli.loadout_id IN (${placeholders})
               AND nli.is_hidden = 0
             ORDER BY nli.loadout_id, nli.id`,
          )
          .bind(...loadoutIds)
          .all()
        items = results
      }

      const itemsByLoadout = new Map<number, typeof items>()
      for (const item of items) {
        const loadoutId = item.loadout_id as number
        if (!itemsByLoadout.has(loadoutId)) itemsByLoadout.set(loadoutId, [])
        itemsByLoadout.get(loadoutId)!.push(item)
      }

      const loadoutsWithItems = loadouts.map((loadout) => ({
        ...loadout,
        items: itemsByLoadout.get(loadout.id as number) ?? [],
      }))

      return {
        faction,
        loadouts: loadoutsWithItems,
        page,
        perPage,
        totalLoadouts,
        totalPages,
      }
    })
  })

  // GET /api/gamedata/missions — mission types + givers with faction/location data
  // NOTE: intentionally API-only for now (no frontend page). The data exists (38 mission
  // types) and is returned correctly; a Missions page is deferred to a future milestone.
  app.get("/missions", async (c) => {
    const db = c.env.DB
    const patch = c.req.query("patch")
    const versionId = await resolveVersionId(db, patch)
    const dvjTypes = deltaVersionJoin('mission_types', 'mt', 'uuid', versionId)
    const dvjGivers = deltaVersionJoin('mission_givers', 'mg', 'uuid', versionId)
    const dvjMissions = deltaVersionJoin('missions', 'm', 'uuid', versionId)
    return cachedJson(c, `gd:missions:${versionId}`, async () => {
      const [typesResult, giversResult, missionsResult] = await Promise.all([
        db.prepare(
          `SELECT mt.* FROM mission_types mt
           ${dvjTypes}
           WHERE mt.name != '<= PLACEHOLDER =>'
           ORDER BY mt.name`,
        ).all(),
        db.prepare(
          `SELECT mg.*,
             f.name as faction_name, f.slug as faction_slug,
             sml.name as location_name
           FROM mission_givers mg
           ${dvjGivers}
           LEFT JOIN factions f ON f.id = mg.faction_id
           LEFT JOIN star_map_locations sml ON sml.id = mg.location_id
           WHERE mg.name != '<= PLACEHOLDER =>'
             AND mg.name != '<= UNINITIALIZED =>'
           ORDER BY mg.name`,
        ).all(),
        db.prepare(
          `SELECT m.id, m.title, m.display_name as giver_name, m.description,
             m.reward_amount, m.reward_currency, m.is_lawful, m.difficulty,
             m.category, m.subcategory as availability,
             m.location_hint as type_slug,
             m.reputation_reward_size as rep_summary
           FROM missions m
           ${dvjMissions}
           WHERE m.not_for_release = 0
           ORDER BY m.category, m.reward_amount DESC`,
        ).all(),
      ])

      return {
        types: typesResult.results,
        givers: giversResult.results,
        missions: missionsResult.results,
      }
    })
  })

  // GET /api/gamedata/crafting — all blueprints with slots and modifiers
  app.get("/crafting", async (c) => {
    const db = c.env.DB
    const versionId = await resolveVersionId(db, c.req.query("patch"))
    const dvjBlueprints = deltaVersionJoin('crafting_blueprints', 'cb', 'uuid', versionId)
    const dvjResources = deltaVersionJoin('crafting_resources', 'cr', 'name', versionId)
    return cachedJson(c, `gd:crafting:${versionId}`, async () => {
      const [bpResult, slotResult, modResult, propResult, resResult] = await Promise.all([
        db.prepare(
          `SELECT cb.id, cb.uuid, cb.tag, cb.name, cb.type, cb.sub_type, cb.craft_time_seconds
           FROM crafting_blueprints cb
           ${dvjBlueprints}
           ORDER BY cb.type, cb.sub_type, cb.name`
        ).all(),
        db.prepare(
          `SELECT cbs.id, cbs.crafting_blueprint_id, cbs.slot_index, cbs.name,
                  cbs.resource_name, cbs.quantity, cbs.min_quality
           FROM crafting_blueprint_slots cbs
           JOIN crafting_blueprints cb ON cb.id = cbs.crafting_blueprint_id
           ${dvjBlueprints}
           ORDER BY cbs.crafting_blueprint_id, cbs.slot_index`
        ).all(),
        db.prepare(
          `SELECT csm.crafting_blueprint_slot_id, cp.key, cp.name, cp.unit, cp.category,
                  csm.start_quality, csm.end_quality, csm.modifier_at_start, csm.modifier_at_end
           FROM crafting_slot_modifiers csm
           JOIN crafting_properties cp ON cp.id = csm.crafting_property_id
           JOIN crafting_blueprint_slots cbs ON cbs.id = csm.crafting_blueprint_slot_id
           JOIN crafting_blueprints cb ON cb.id = cbs.crafting_blueprint_id
           ${dvjBlueprints}`
        ).all(),
        db.prepare(`SELECT id, key, name, unit, category FROM crafting_properties ORDER BY id`).all(),
        db.prepare(
          `SELECT cr.name FROM crafting_resources cr
           ${dvjResources}
           ORDER BY cr.name`
        ).all(),
      ])

      // Nest slots and modifiers into blueprints
      const modsBySlot = new Map<number, Record<string, unknown>[]>()
      for (const mod of modResult.results) {
        const slotId = mod.crafting_blueprint_slot_id as number
        if (!modsBySlot.has(slotId)) modsBySlot.set(slotId, [])
        modsBySlot.get(slotId)!.push(mod)
      }

      const slotsByBp = new Map<number, Record<string, unknown>[]>()
      for (const slot of slotResult.results) {
        const bpId = slot.crafting_blueprint_id as number
        const slotId = slot.id as number
        const enriched = { ...slot, modifiers: modsBySlot.get(slotId) ?? [] }
        if (!slotsByBp.has(bpId)) slotsByBp.set(bpId, [])
        slotsByBp.get(bpId)!.push(enriched)
      }

      // Look up base stats for weapon/armour blueprints by matching
      // blueprint tag (BP_CRAFT_xxx) → fps_weapons/fps_armour class_name (xxx)
      const weaponTags = bpResult.results
        .filter((bp) => bp.type === "weapons")
        .map((bp) => (bp.tag as string).replace("BP_CRAFT_", ""))
      const armourTags = bpResult.results
        .filter((bp) => bp.type === "armour")
        .map((bp) => (bp.tag as string).replace("BP_CRAFT_", ""))

      const baseStatsMap = new Map<string, Record<string, unknown>>()

      if (weaponTags.length > 0) {
        const dvjWeapons = deltaVersionJoin('fps_weapons', 'fw', 'uuid', versionId)
        const weaponResult = await db.prepare(
          `SELECT fw.class_name, fw.name, fw.rounds_per_minute, fw.damage, fw.dps,
                  fw.effective_range, fw.projectile_speed, fw.ammo_capacity,
                  fw.spread_min, fw.spread_max, fw.damage_type, fw.fire_modes
           FROM fps_weapons fw
           ${dvjWeapons}`
        ).all()
        for (const w of weaponResult.results) {
          const cn = w.class_name as string
          if (weaponTags.includes(cn) && !baseStatsMap.has(cn)) {
            baseStatsMap.set(cn, {
              item_name: w.name,
              rounds_per_minute: w.rounds_per_minute,
              damage: w.damage,
              dps: w.dps,
              effective_range: w.effective_range,
              projectile_speed: w.projectile_speed,
              ammo_capacity: w.ammo_capacity,
              spread_min: w.spread_min,
              spread_max: w.spread_max,
              damage_type: w.damage_type,
              fire_modes: w.fire_modes,
            })
          }
        }
      }

      if (armourTags.length > 0) {
        const dvjArmour = deltaVersionJoin('fps_armour', 'fa', 'uuid', versionId)
        const dvjHelmets = deltaVersionJoin('fps_helmets', 'fh', 'uuid', versionId)
        // Query fps_armour (body pieces + undersuits) and fps_helmets in parallel
        const [armourResult, helmetResult] = await Promise.all([
          db.prepare(
            `SELECT fa.class_name, fa.name, fa.sub_type,
                    fa.resist_physical, fa.resist_energy, fa.resist_distortion,
                    fa.resist_thermal, fa.resist_biochemical, fa.resist_stun
             FROM fps_armour fa
             ${dvjArmour}`
          ).all(),
          db.prepare(
            `SELECT fh.class_name, fh.name
             FROM fps_helmets fh
             ${dvjHelmets}`
          ).all(),
        ])
        for (const a of armourResult.results) {
          const cn = a.class_name as string
          if (armourTags.includes(cn) && !baseStatsMap.has(cn)) {
            baseStatsMap.set(cn, {
              item_name: a.name,
              sub_type: a.sub_type,
              resist_physical: a.resist_physical,
              resist_energy: a.resist_energy,
              resist_distortion: a.resist_distortion,
              resist_thermal: a.resist_thermal,
              resist_biochemical: a.resist_biochemical,
              resist_stun: a.resist_stun,
            })
          }
        }
        for (const h of helmetResult.results) {
          const cn = h.class_name as string
          if (armourTags.includes(cn) && !baseStatsMap.has(cn)) {
            baseStatsMap.set(cn, { item_name: h.name })
          }
        }
      }

      const blueprints = bpResult.results.map((bp) => {
        const tag = bp.tag as string
        const className = tag.replace("BP_CRAFT_", "")
        // Strip variant suffixes to find the base weapon
        // e.g. behr_lmg_ballistic_01_tint01 → behr_lmg_ballistic_01
        let baseStats = baseStatsMap.get(className)
        if (!baseStats) {
          // Try matching base weapon by removing trailing _suffix patterns
          // Variants: _tint01, _xenothreat01, _yellow_grey01, _collector01, etc.
          for (const [cn, stats] of baseStatsMap) {
            if (className.startsWith(cn + "_") || className === cn) {
              baseStats = stats
              break
            }
          }
        }
        return {
          ...bp,
          slots: slotsByBp.get(bp.id as number) ?? [],
          ...(baseStats ? { base_stats: baseStats } : {}),
        }
      })

      // Fetch resource location data (where each crafting resource can be mined)
      const [depositResult, qualityResult] = await Promise.all([
        db
          .prepare(
            `SELECT rc.class_name, rc.composition_json,
                    ml.name as location_name, ml.system, ml.location_type,
                    mld.group_probability, mld.relative_probability
             FROM mining_location_deposits mld
             JOIN rock_compositions rc ON rc.id = mld.rock_composition_id
             JOIN mining_locations ml ON ml.id = mld.mining_location_id
             WHERE rc.game_version_id <= ${versionSub(versionId)}
               AND ml.game_version_id <= ${versionSub(versionId)}
               AND rc.class_name LIKE 'Asteroid_%' AND rc.class_name NOT LIKE '%test%'`
          )
          .all(),
        db
          .prepare(
            `SELECT name, min_quality, max_quality, mean, stddev
             FROM mining_quality_distributions
             WHERE game_version_id <= ${versionSub(versionId)}
               AND (name LIKE '%ShipMineable%' OR name LIKE '%Mineable%' OR name LIKE '%GroundMineable%')`
          )
          .all(),
      ])

      // Build quality distribution lookup: { "Common_Default": {...}, "Common_Pyro": {...} }
      const qualityMap = new Map<string, Record<string, unknown>>()
      for (const q of qualityResult.results) {
        const name = q.name as string
        // Extract tier + system from names like "CommonShipMineable_QualityDistribution_Default"
        // or "CommonShipMineable_QualityOverride_Pyro"
        const tierMatch = name.match(
          /^(Common|Uncommon|Rare|Epic|Legendary)ShipMineable_Quality(?:Distribution|Override)_(\w+)$/
        )
        if (tierMatch) {
          qualityMap.set(`${tierMatch[1]}_${tierMatch[2]}`, {
            min_quality: q.min_quality,
            max_quality: q.max_quality,
            mean: q.mean,
            stddev: q.stddev,
          })
        }
      }

      // Element name → crafting resource name mapping
      const elementToResource = (element: string): string | null => {
        // Strip _ore / _raw suffix
        const base = element.replace(/_(ore|raw)$/, "")
        // Handle British → American spelling
        const name = base === "aluminium" ? "aluminum" : base
        // Capitalize first letter
        const capitalized = name.charAt(0).toUpperCase() + name.slice(1)
        // Verify it's a known crafting resource
        const knownResources = new Set(
          resResult.results.map((r) => r.name as string)
        )
        return knownResources.has(capitalized) ? capitalized : null
      }

      // Build resource_locations: { "Aluminum": [{ location, system, type, rock_tier, quality }] }
      type LocationEntry = {
        location: string
        system: string
        type: string
        rock_tier: string
        element_pct: { min: number; max: number }
        quality: Record<string, unknown> | null
      }
      const resourceLocations: Record<string, LocationEntry[]> = {}

      for (const dep of depositResult.results) {
        const className = dep.class_name as string
        const compositionJson = dep.composition_json as string
        if (!compositionJson) continue

        // Extract rock tier from class_name
        const tierMatch = className.match(
          /^(Common|Uncommon|Rare|Epic|Legendary)ShipMineables/
        )
        if (!tierMatch) continue
        const tier = tierMatch[1]

        // Parse composition to find elements
        let elements: {
          element: string
          minPct: number
          maxPct: number
          probability?: number
        }[]
        try {
          elements = JSON.parse(compositionJson)
        } catch {
          continue
        }

        // Get quality distribution for this tier + location system
        const system = dep.system as string
        const qualityKey =
          system === "Pyro" ? `${tier}_Pyro` : `${tier}_Default`
        const quality = qualityMap.get(qualityKey) ?? null

        for (const el of elements) {
          const resourceName = elementToResource(el.element)
          if (!resourceName) continue

          if (!resourceLocations[resourceName])
            resourceLocations[resourceName] = []

          // Deduplicate: same resource + location + tier
          const locName = dep.location_name as string
          const existing = resourceLocations[resourceName].find(
            (e) =>
              e.location === locName &&
              e.rock_tier === tier &&
              e.element_pct.min === el.minPct &&
              e.element_pct.max === el.maxPct
          )
          if (!existing) {
            resourceLocations[resourceName].push({
              location: locName,
              system,
              type: dep.location_type as string,
              rock_tier: tier,
              element_pct: { min: el.minPct, max: el.maxPct },
              quality,
            })
          }
        }
      }

      return {
        blueprints,
        properties: propResult.results,
        resources: resResult.results.map((r) => r.name),
        resource_locations: resourceLocations,
      }
    })
  })

  return app
}
