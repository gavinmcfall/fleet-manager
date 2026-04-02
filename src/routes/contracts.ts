import { Hono } from "hono"
import type { HonoEnv } from "../lib/types"
import { ARMOR_SET_REWARD_MAP } from "../lib/loot-sets"
import { cachedJson, cacheSlug } from "../lib/cache"

/**
 * /api/contracts — Named NPC contract reference data (public, no auth required)
 */
export function contractRoutes<E extends HonoEnv>() {
  const app = new Hono<E>()

  // GET /api/contracts?giver=wikelo|gfs|ruto
  app.get("/", async (c) => {
    const db = c.env.DB
    const giver = c.req.query("giver")
    if (giver && giver.length > 100) {
      return c.json({ error: "Invalid filter" }, 400)
    }

    return cachedJson(c, `contracts:${cacheSlug(giver ?? "all")}`, async () => {
      let query = `SELECT c.*,
          COALESCE(c.reward_vehicle_slug, v.slug) AS reward_vehicle_slug,
          COALESCE(c.reward_item_uuid, fw.uuid) AS reward_item_uuid
        FROM contracts c
        LEFT JOIN vehicles v ON v.name = c.reward_text AND c.reward_vehicle_slug IS NULL
        LEFT JOIN fps_weapons fw ON fw.name = c.reward_text AND c.reward_item_uuid IS NULL
        WHERE c.is_active = 1`
      const params: string[] = []

      if (giver) {
        query += " AND c.giver_slug = ?"
        params.push(giver)
      }

      query += " ORDER BY c.giver_slug, CASE c.giver_slug WHEN 'wikelo' THEN CASE c.category WHEN 'Standard' THEN 0 WHEN 'Favours' THEN 1 WHEN 'Small Items' THEN 2 WHEN 'Vehicle Delivery' THEN 3 ELSE 4 END ELSE 0 END, c.sequence_num, c.id"

      const { results } = await db.prepare(query).bind(...params).all()

      // Attach armor set slugs for rewards that match known sets
      for (const row of results as Record<string, unknown>[]) {
        if (!row.reward_vehicle_slug && !row.reward_item_uuid && row.reward_text) {
          const setSlug = ARMOR_SET_REWARD_MAP[row.reward_text as string]
          if (setSlug) row.reward_set_slug = setSlug
        }
      }

      return results
    })
  })

  return app
}
