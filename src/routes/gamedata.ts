import { Hono } from "hono"
import type { HonoEnv } from "../lib/types"

const DEFAULT_VERSION_SUBQUERY = "(SELECT id FROM game_versions WHERE is_default = 1)"

/**
 * /api/gamedata — Public reference data for careers, reputation, law, mining, shops
 */
export function gamedataRoutes<E extends HonoEnv>() {
  const app = new Hono<E>()

  // GET /api/gamedata/careers — vehicle careers + roles
  app.get("/careers", async (c) => {
    const db = c.env.DB

    const { results: careers } = await db
      .prepare("SELECT * FROM vehicle_careers ORDER BY name")
      .all()

    const { results: roles } = await db
      .prepare(
        `SELECT vr.*, vc.name as career_name
         FROM vehicle_roles vr
         LEFT JOIN vehicle_careers vc ON vc.id = vr.career_id
         ORDER BY vc.name, vr.name`,
      )
      .all()

    return c.json({ careers, roles })
  })

  // GET /api/gamedata/reputation — reputation scopes with nested standings
  app.get("/reputation", async (c) => {
    const db = c.env.DB

    const { results: scopes } = await db
      .prepare(
        `SELECT * FROM reputation_scopes
         WHERE game_version_id = ${DEFAULT_VERSION_SUBQUERY}
         ORDER BY name`,
      )
      .all()

    const { results: standings } = await db
      .prepare(
        `SELECT rs.*, rsc.name as scope_name, rsc.uuid as scope_uuid
         FROM reputation_standings rs
         JOIN reputation_scopes rsc ON rsc.id = rs.scope_id
         WHERE rs.game_version_id = ${DEFAULT_VERSION_SUBQUERY}
         ORDER BY rs.scope_id, rs.sort_order`,
      )
      .all()

    // Nest standings under their parent scope
    const standingsByScope = new Map<number, typeof standings>()
    for (const s of standings) {
      const scopeId = s.scope_id as number
      if (!standingsByScope.has(scopeId)) standingsByScope.set(scopeId, [])
      standingsByScope.get(scopeId)!.push(s)
    }

    const scopesWithStandings = scopes.map((scope) => ({
      ...scope,
      standings: standingsByScope.get(scope.id as number) ?? [],
    }))

    return c.json({ scopes: scopesWithStandings })
  })

  // GET /api/gamedata/law — infractions, jurisdictions, overrides
  app.get("/law", async (c) => {
    const db = c.env.DB

    const [infractions, jurisdictions, overrides] = await Promise.all([
      db
        .prepare(
          `SELECT * FROM law_infractions
           WHERE game_version_id = ${DEFAULT_VERSION_SUBQUERY}
           ORDER BY name`,
        )
        .all(),
      db
        .prepare(
          `SELECT * FROM law_jurisdictions
           WHERE game_version_id = ${DEFAULT_VERSION_SUBQUERY}
           ORDER BY name`,
        )
        .all(),
      db
        .prepare(
          `SELECT jio.*, li.name as infraction_name, lj.name as jurisdiction_name
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
           (SELECT COUNT(*) FROM shop_inventory si WHERE si.shop_id = s.id) as item_count
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
        `SELECT si.*
         FROM shop_inventory si
         JOIN shops s ON s.id = si.shop_id
         WHERE s.slug = ?
           AND s.game_version_id = ${DEFAULT_VERSION_SUBQUERY}
         ORDER BY si.buy_price DESC`,
      )
      .bind(slug)
      .all()

    return c.json(results)
  })

  return app
}
