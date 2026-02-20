import { Hono } from "hono";
import type { Env } from "../lib/types";

/**
 * /api/debug/* — Debug endpoints
 */
export function debugRoutes<E extends { Bindings: Env }>() {
  const routes = new Hono<E>();

  // GET /api/debug/imports — debug import state
  routes.get("/imports", async (c) => {
    const db = c.env.DB;

    const userRow = await db
      .prepare("SELECT id FROM users WHERE username = 'default'")
      .first<{ id: number }>();
    if (!userRow) {
      return c.json({ error: "Default user not found" }, 500);
    }
    const userID = userRow.id;

    const vehicleCount = await db
      .prepare("SELECT COUNT(*) as count FROM vehicles")
      .first<{ count: number }>();
    const fleetCount = await db
      .prepare("SELECT COUNT(*) as count FROM user_fleet WHERE user_id = ?")
      .bind(userID)
      .first<{ count: number }>();

    // Sample fleet entries
    const sampleResult = await db
      .prepare(
        `SELECT uf.id, uf.vehicle_id, v.name as vehicle_name, v.slug as vehicle_slug,
          it.label as insurance, uf.custom_name
        FROM user_fleet uf
        JOIN vehicles v ON v.id = uf.vehicle_id
        LEFT JOIN insurance_types it ON it.id = uf.insurance_type_id
        WHERE uf.user_id = ?
        ORDER BY v.name
        LIMIT 5`,
      )
      .bind(userID)
      .all();

    return c.json({
      vehicle_ref_count: vehicleCount?.count ?? 0,
      user_fleet_count: fleetCount?.count ?? 0,
      sample_fleet: sampleResult.results,
    });
  });

  return routes;
}
