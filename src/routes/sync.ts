import { Hono } from "hono";
import type { Env } from "../lib/types";

/**
 * /api/sync/* — Sync management
 */
export function syncRoutes<E extends { Bindings: Env }>() {
  const routes = new Hono<E>();

  // GET /api/sync/status — recent sync history
  routes.get("/status", async (c) => {
    const db = c.env.DB;
    const result = await db
      .prepare(
        `SELECT sh.id, sh.source_id, sh.endpoint, sh.status, sh.record_count,
          sh.error_message, sh.started_at, sh.completed_at,
          ss.label as source_label
        FROM sync_history sh
        LEFT JOIN sync_sources ss ON ss.id = sh.source_id
        ORDER BY sh.started_at DESC LIMIT 10`,
      )
      .all();
    return c.json(result.results);
  });

  // POST /api/sync/scwiki — trigger SC Wiki sync
  routes.post("/scwiki", async (c) => {
    // TODO: Phase 4 — implement SC Wiki sync
    return c.json({ message: "SC Wiki sync started" }, 202);
  });

  // POST /api/sync/images — trigger image sync
  routes.post("/images", async (c) => {
    // TODO: Phase 4 — implement FleetYards image sync
    return c.json({ message: "Image sync started" }, 202);
  });

  // POST /api/sync/paints — trigger paint sync
  routes.post("/paints", async (c) => {
    // TODO: Phase 4 — implement paint sync pipeline
    return c.json({ message: "Paint sync started" }, 202);
  });

  return routes;
}
