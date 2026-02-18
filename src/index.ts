import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./lib/types";
import { fleetRoutes } from "./routes/fleet";
import { vehicleRoutes } from "./routes/vehicles";
import { paintRoutes } from "./routes/paints";
import { importRoutes } from "./routes/import";
import { settingsRoutes } from "./routes/settings";
import { syncRoutes } from "./routes/sync";
import { analysisRoutes } from "./routes/analysis";
import { debugRoutes } from "./routes/debug";

type HonoEnv = { Bindings: Env };

const app = new Hono<HonoEnv>();

// Middleware
app.use("/api/*", cors());

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Status endpoint
app.get("/api/status", async (c) => {
  const db = c.env.DB;

  const vehicleCount = await db
    .prepare("SELECT COUNT(*) as count FROM vehicles")
    .first<{ count: number }>();
  const paintCount = await db
    .prepare("SELECT COUNT(*) as count FROM paints")
    .first<{ count: number }>();
  const fleetCount = await db
    .prepare(
      "SELECT COUNT(*) as count FROM user_fleet WHERE user_id = (SELECT id FROM users WHERE username = 'default')",
    )
    .first<{ count: number }>();

  const syncHistory = await db
    .prepare(
      `SELECT sh.id, sh.source_id, sh.endpoint, sh.status, sh.record_count,
        sh.error_message, sh.started_at, sh.completed_at, ss.label as source_label
      FROM sync_history sh
      LEFT JOIN sync_sources ss ON ss.id = sh.source_id
      ORDER BY sh.started_at DESC LIMIT 10`,
    )
    .all();

  return c.json({
    ships: vehicleCount?.count ?? 0,
    paints: paintCount?.count ?? 0,
    vehicles: fleetCount?.count ?? 0,
    sync_status: syncHistory.results,
    config: {
      sync_schedule: "0 3 * * *",
      db_driver: "d1",
    },
  });
});

// Mount route groups — matches Go router URL structure exactly
app.route("/api/ships", vehicleRoutes<HonoEnv>());
app.route("/api/vehicles", fleetRoutes<HonoEnv>());
app.route("/api/paints", paintRoutes<HonoEnv>());
app.route("/api/import", importRoutes<HonoEnv>());
app.route("/api/settings", settingsRoutes<HonoEnv>());
app.route("/api/sync", syncRoutes<HonoEnv>());
app.route("/api", analysisRoutes<HonoEnv>());
app.route("/api/debug", debugRoutes<HonoEnv>());

// SPA catch-all — forward non-API requests to Workers Assets (serves index.html)
app.get("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,

  // Cron Trigger handler — nightly sync
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(runScheduledSync(env));
  },
};

async function runScheduledSync(_env: Env): Promise<void> {
  console.log("[cron] Scheduled sync started");

  // TODO: Phase 4 — implement sync pipeline
  // 1. SC Wiki sync (manufacturers, vehicles, loaners)
  // 2. FleetYards image sync
  // 3. scunpacked paint metadata (fetch from GitHub)
  // 4. FleetYards paint image sync
  // 5. RSI API image sync (if enabled)

  console.log("[cron] Scheduled sync complete");
}
