import { Hono } from "hono";
import type { Env, Paint } from "../lib/types";

/**
 * /api/paints/* — Paint database
 */
export function paintRoutes<E extends { Bindings: Env }>() {
  const routes = new Hono<E>();

  // GET /api/paints — list all paints with associated vehicles
  routes.get("/", async (c) => {
    const db = c.env.DB;
    const paints = await getAllPaints(db);
    return c.json(paints);
  });

  // GET /api/paints/ship/:slug — get paints for a specific vehicle
  routes.get("/ship/:slug", async (c) => {
    const slug = c.req.param("slug");
    const db = c.env.DB;
    const paints = await getPaintsForVehicle(db, slug);
    return c.json(paints);
  });

  return routes;
}

async function getAllPaints(db: D1Database): Promise<Paint[]> {
  // Query 1: all paints
  const paintResult = await db
    .prepare(
      `SELECT p.id, p.uuid, p.name, p.slug, p.class_name,
        p.description, p.image_url, p.image_url_small, p.image_url_medium, p.image_url_large,
        p.created_at, p.updated_at
      FROM paints p
      ORDER BY p.name`,
    )
    .all();

  const paints: Paint[] = paintResult.results.map((row) => ({
    ...(row as unknown as Paint),
    vehicles: [],
  }));

  if (paints.length === 0) return paints;

  // Build index map
  const paintIdx = new Map<number, number>();
  paints.forEach((p, i) => paintIdx.set(p.id, i));

  // Query 2: all paint-vehicle associations
  const vResult = await db
    .prepare(
      `SELECT pv.paint_id, v.id, v.name, v.slug
      FROM paint_vehicles pv
      JOIN vehicles v ON v.id = pv.vehicle_id
      ORDER BY pv.paint_id, v.name`,
    )
    .all();

  for (const row of vResult.results) {
    const r = row as { paint_id: number; id: number; name: string; slug: string };
    const idx = paintIdx.get(r.paint_id);
    if (idx !== undefined) {
      paints[idx].vehicles.push({ id: r.id, name: r.name, slug: r.slug });
    }
  }

  return paints;
}

async function getPaintsForVehicle(db: D1Database, vehicleSlug: string): Promise<Paint[]> {
  // Query 1: paints associated with the target vehicle
  const paintResult = await db
    .prepare(
      `SELECT p.id, p.uuid, p.name, p.slug, p.class_name,
        p.description, p.image_url, p.image_url_small, p.image_url_medium, p.image_url_large,
        p.created_at, p.updated_at
      FROM paints p
      WHERE p.id IN (
        SELECT pv.paint_id FROM paint_vehicles pv
        JOIN vehicles v ON v.id = pv.vehicle_id
        WHERE v.slug = ?
      )
      ORDER BY p.name`,
    )
    .bind(vehicleSlug)
    .all();

  const paints: Paint[] = paintResult.results.map((row) => ({
    ...(row as unknown as Paint),
    vehicles: [],
  }));

  if (paints.length === 0) return paints;

  // Build index map
  const paintIdx = new Map<number, number>();
  paints.forEach((p, i) => paintIdx.set(p.id, i));

  // Query 2: ALL vehicle associations for these paint IDs
  const paintIDs = paints.map((p) => p.id);
  const placeholders = paintIDs.map(() => "?").join(",");
  const vResult = await db
    .prepare(
      `SELECT pv.paint_id, v.id, v.name, v.slug
      FROM paint_vehicles pv
      JOIN vehicles v ON v.id = pv.vehicle_id
      WHERE pv.paint_id IN (${placeholders})
      ORDER BY pv.paint_id, v.name`,
    )
    .bind(...paintIDs)
    .all();

  for (const row of vResult.results) {
    const r = row as { paint_id: number; id: number; name: string; slug: string };
    const idx = paintIdx.get(r.paint_id);
    if (idx !== undefined) {
      paints[idx].vehicles.push({ id: r.id, name: r.name, slug: r.slug });
    }
  }

  return paints;
}
