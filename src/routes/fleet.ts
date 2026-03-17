import { Hono } from "hono";
import { z } from "zod";
import { getAuthUser, type HonoEnv } from "../lib/types";
import { validate, IntIdParam, OrgVisibility } from "../lib/validation";

/**
 * /api/vehicles/* — User's fleet
 */
export function fleetRoutes() {
  const routes = new Hono<HonoEnv>();

  // GET /api/vehicles — list user fleet with full reference data
  routes.get("/", async (c) => {
    return getFleetList(c.env.DB, getAuthUser(c).id, c);
  });

  // GET /api/vehicles/with-insurance — alias (insurance is already part of fleet data)
  routes.get("/with-insurance", async (c) => {
    return getFleetList(c.env.DB, getAuthUser(c).id, c);
  });

  // PATCH /api/vehicles/:id/visibility — update org_visibility and/or available_for_ops
  routes.patch("/:id/visibility",
    validate("param", IntIdParam),
    validate("json", z.object({
      org_visibility: OrgVisibility.optional(),
      available_for_ops: z.boolean().optional(),
    }).refine((d) => d.org_visibility !== undefined || d.available_for_ops !== undefined, {
      message: "No fields to update",
    })),
    async (c) => {
    const { id } = c.req.valid("param");
    const db = c.env.DB;
    const userID = getAuthUser(c).id;

    const body = c.req.valid("json");

    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.org_visibility !== undefined) {
      updates.push("org_visibility = ?");
      values.push(body.org_visibility);
    }

    if (body.available_for_ops !== undefined) {
      updates.push("available_for_ops = ?");
      values.push(body.available_for_ops ? 1 : 0);
    }

    values.push(userID, id);

    const result = await db
      .prepare(`UPDATE user_fleet SET ${updates.join(", ")} WHERE user_id = ? AND id = ?`)
      .bind(...values)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ error: "Not found or not authorized" }, 404);
    }

    return c.json({ ok: true });
  });

  // GET /api/vehicles/:id/upgrades — get CCU chain for a fleet entry
  routes.get("/:id/upgrades",
    validate("param", IntIdParam),
    async (c) => {
    const { id } = c.req.valid("param");
    const db = c.env.DB;
    const userID = getAuthUser(c).id;

    // Get the fleet entry's pledge_id
    const fleetEntry = await db
      .prepare("SELECT pledge_id FROM user_fleet WHERE id = ? AND user_id = ?")
      .bind(id, userID)
      .first<{ pledge_id: string | null }>();

    if (!fleetEntry?.pledge_id) {
      return c.json({ pledge: null, upgrades: [] });
    }

    const rsiPledgeId = parseInt(fleetEntry.pledge_id, 10);
    if (isNaN(rsiPledgeId)) {
      return c.json({ pledge: null, upgrades: [] });
    }

    // Get the pledge
    const pledge = await db
      .prepare(
        `SELECT id, rsi_pledge_id, name, value, value_cents, pledge_date, pledge_date_parsed,
          is_upgraded, currency, availability
        FROM user_pledges WHERE user_id = ? AND rsi_pledge_id = ?`,
      )
      .bind(userID, rsiPledgeId)
      .first();

    if (!pledge) {
      return c.json({ pledge: null, upgrades: [] });
    }

    // Get the upgrade chain, ordered by sort_order
    const upgrades = await db
      .prepare(
        `SELECT upgrade_name, applied_at, applied_at_parsed, new_value, new_value_cents, sort_order
        FROM user_pledge_upgrades
        WHERE user_pledge_id = ?
        ORDER BY sort_order ASC`,
      )
      .bind(pledge.id)
      .all();

    return c.json({
      pledge,
      upgrades: upgrades.results,
    });
  });

  return routes;
}

async function getFleetList(
  db: D1Database,
  userID: string,
  c: { json: (data: unknown, status?: number) => Response },
) {
  const result = await db
    .prepare(
      `SELECT uf.id, uf.user_id, uf.vehicle_id, uf.insurance_type_id, uf.warbond, uf.is_loaner,
        uf.pledge_id, uf.pledge_name, uf.pledge_cost, uf.pledge_date, uf.custom_name,
        uf.equipped_paint_id, uf.imported_at, uf.org_visibility, uf.available_for_ops,
        v.name as vehicle_name, v.slug as vehicle_slug, v.image_url, v.focus, v.size_label, v.cargo,
        v.crew_min, v.crew_max, v.pledge_price, v.speed_scm, v.classification,
        m.name as manufacturer_name, m.code as manufacturer_code,
        it.label as insurance_label, it.duration_months, it.is_lifetime,
        p.name as paint_name,
        ps.key as production_status,
        COALESCE(latest_upg.new_value_cents, up.value_cents) as current_value_cents
      FROM user_fleet uf
      JOIN vehicles v ON v.id = uf.vehicle_id
      LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
      LEFT JOIN insurance_types it ON it.id = uf.insurance_type_id
      LEFT JOIN paints p ON p.id = uf.equipped_paint_id
      LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
      LEFT JOIN user_pledges up ON up.user_id = uf.user_id
        AND up.rsi_pledge_id = CAST(uf.pledge_id AS INTEGER)
      LEFT JOIN (
        SELECT user_pledge_id, new_value_cents
        FROM user_pledge_upgrades
        WHERE (user_pledge_id, sort_order) IN (
          SELECT user_pledge_id, MAX(sort_order) FROM user_pledge_upgrades GROUP BY user_pledge_id
        )
      ) latest_upg ON latest_upg.user_pledge_id = up.id
      WHERE uf.user_id = ?
      ORDER BY v.name`,
    )
    .bind(userID)
    .all();

  return c.json(result.results);
}
