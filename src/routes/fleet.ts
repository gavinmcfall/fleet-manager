import { Hono } from "hono";
import type { Env } from "../lib/types";

/**
 * /api/vehicles/* — User's fleet
 */
export function fleetRoutes<E extends { Bindings: Env }>() {
  const routes = new Hono<E>();

  // GET /api/vehicles — list user fleet with full reference data
  routes.get("/", async (c) => {
    const db = c.env.DB;
    const userID = await getDefaultUserID(db);
    if (userID === null) {
      return c.json({ error: "Default user not found" }, 500);
    }

    const result = await db
      .prepare(
        `SELECT uf.id, uf.user_id, uf.vehicle_id, uf.insurance_type_id, uf.warbond, uf.is_loaner,
          uf.pledge_id, uf.pledge_name, uf.pledge_cost, uf.pledge_date, uf.custom_name,
          uf.equipped_paint_id, uf.imported_at,
          v.name as vehicle_name, v.slug as vehicle_slug, v.image_url, v.focus, v.size_label, v.cargo,
          v.crew_min, v.crew_max, v.pledge_price, v.speed_scm, v.classification,
          m.name as manufacturer_name, m.code as manufacturer_code,
          it.label as insurance_label, it.duration_months, it.is_lifetime,
          p.name as paint_name,
          ps.key as production_status
        FROM user_fleet uf
        JOIN vehicles v ON v.id = uf.vehicle_id
        LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
        LEFT JOIN insurance_types it ON it.id = uf.insurance_type_id
        LEFT JOIN paints p ON p.id = uf.equipped_paint_id
        LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
        WHERE uf.user_id = ?
        ORDER BY v.name`,
      )
      .bind(userID)
      .all();

    return c.json(result.results);
  });

  // GET /api/vehicles/with-insurance — same endpoint (insurance is part of user_fleet)
  routes.get("/with-insurance", async (c) => {
    // Redirect to the main fleet endpoint handler
    const db = c.env.DB;
    const userID = await getDefaultUserID(db);
    if (userID === null) {
      return c.json({ error: "Default user not found" }, 500);
    }

    const result = await db
      .prepare(
        `SELECT uf.id, uf.user_id, uf.vehicle_id, uf.insurance_type_id, uf.warbond, uf.is_loaner,
          uf.pledge_id, uf.pledge_name, uf.pledge_cost, uf.pledge_date, uf.custom_name,
          uf.equipped_paint_id, uf.imported_at,
          v.name as vehicle_name, v.slug as vehicle_slug, v.image_url, v.focus, v.size_label, v.cargo,
          v.crew_min, v.crew_max, v.pledge_price, v.speed_scm, v.classification,
          m.name as manufacturer_name, m.code as manufacturer_code,
          it.label as insurance_label, it.duration_months, it.is_lifetime,
          p.name as paint_name,
          ps.key as production_status
        FROM user_fleet uf
        JOIN vehicles v ON v.id = uf.vehicle_id
        LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
        LEFT JOIN insurance_types it ON it.id = uf.insurance_type_id
        LEFT JOIN paints p ON p.id = uf.equipped_paint_id
        LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
        WHERE uf.user_id = ?
        ORDER BY v.name`,
      )
      .bind(userID)
      .all();

    return c.json(result.results);
  });

  return routes;
}

async function getDefaultUserID(db: D1Database): Promise<number | null> {
  const row = await db
    .prepare("SELECT id FROM users WHERE username = 'default'")
    .first<{ id: number }>();
  return row?.id ?? null;
}
