import { Hono } from "hono";
import type { Env } from "../lib/types";
import { getAllPaints, getPaintsForVehicle } from "../db/queries";
import { cachedJson } from "../lib/cache";

/**
 * /api/paints/* — Paint database
 */
export function paintRoutes<E extends { Bindings: Env }>() {
  const routes = new Hono<E>();

  // GET /api/paints — list all paints with associated vehicles
  routes.get("/", async (c) => {
    const db = c.env.DB;
    return cachedJson(c,`paints:list`, () =>
      getAllPaints(db),
    );
  });

  // GET /api/paints/ship/:slug — get paints for a specific vehicle
  routes.get("/ship/:slug", async (c) => {
    const slug = c.req.param("slug");
    const db = c.env.DB;
    return cachedJson(c,`paints:ship:${slug}`, () =>
      getPaintsForVehicle(db, slug),
    );
  });

  return routes;
}
