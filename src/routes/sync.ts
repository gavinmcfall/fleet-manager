import { Hono } from "hono";
import type { Env } from "../lib/types";
import {
  triggerSCWikiSync,
  triggerImageSync,
  triggerPaintSync,
  triggerRSISync,
  runFullSync,
} from "../sync/pipeline";

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
    const env = c.env;
    try {
      const msg = await triggerSCWikiSync(env);
      return c.json({ message: msg });
    } catch (err) {
      console.error("[sync] SC Wiki sync failed:", err);
      return c.json({ error: String(err) }, 500);
    }
  });

  // POST /api/sync/images — trigger FleetYards image sync
  routes.post("/images", async (c) => {
    const env = c.env;
    try {
      const msg = await triggerImageSync(env);
      return c.json({ message: msg });
    } catch (err) {
      console.error("[sync] Image sync failed:", err);
      return c.json({ error: String(err) }, 500);
    }
  });

  // POST /api/sync/paints — trigger paint sync pipeline
  routes.post("/paints", async (c) => {
    const env = c.env;
    try {
      const msg = await triggerPaintSync(env);
      return c.json({ message: msg });
    } catch (err) {
      console.error("[sync] Paint sync failed:", err);
      return c.json({ error: String(err) }, 500);
    }
  });

  // POST /api/sync/rsi — trigger RSI API image sync
  routes.post("/rsi", async (c) => {
    const env = c.env;
    try {
      const msg = await triggerRSISync(env);
      return c.json({ message: msg });
    } catch (err) {
      console.error("[sync] RSI sync failed:", err);
      return c.json({ error: String(err) }, 500);
    }
  });

  // POST /api/sync/all — trigger full sync pipeline
  routes.post("/all", async (c) => {
    const env = c.env;
    try {
      await runFullSync(env);
      return c.json({ message: "Full sync pipeline complete" });
    } catch (err) {
      console.error("[sync] Full sync failed:", err);
      return c.json({ error: String(err) }, 500);
    }
  });

  return routes;
}
