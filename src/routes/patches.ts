import { Hono } from "hono";
import type { HonoEnv } from "../lib/types";
import { getGameVersions } from "../db/queries";
import { cachedJson } from "../lib/cache";

/**
 * /api/patches — Public list of available game versions
 */
export function patchRoutes() {
  const app = new Hono<HonoEnv>();

  // GET /api/patches — list all game versions (public)
  app.get("/", async (c) => {
    return cachedJson(c, `patches:list`, () => getGameVersions(c.env.DB), {
      ttl: 3600,
    });
  });

  return app;
}
