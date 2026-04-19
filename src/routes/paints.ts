import { Hono } from "hono";
import type { Env } from "../lib/types";
import { getAllPaints, getPaintsForVehicle, getPaintBySlug } from "../db/queries";
import { cachedJson, cacheSlug } from "../lib/cache";

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
    return cachedJson(c,`paints:ship:${cacheSlug(slug)}`, () =>
      getPaintsForVehicle(db, slug),
    );
  });

  // GET /api/paints/:slug — single paint detail (image + description +
  // compatible vehicles). Defined AFTER `/ship/:slug` so `ship` doesn't get
  // caught as a paint slug. cachedJson auto-404s on null return.
  routes.get("/:slug", async (c) => {
    const slug = c.req.param("slug");
    if (slug.length > 100) return c.json({ error: "Not found" }, 404);
    const db = c.env.DB;
    return cachedJson(c, `paints:detail:${cacheSlug(slug)}`, () =>
      getPaintBySlug(db, slug),
    );
  });

  return routes;
}
