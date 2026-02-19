import { Hono, type Context, type Next } from "hono";
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
import { validateEncryptionKey } from "./lib/crypto";

type HonoEnv = { Bindings: Env };

const app = new Hono<HonoEnv>();

// Validate ENCRYPTION_KEY on first request (fail fast)
let encryptionKeyValidated = false;
app.use("*", async (c, next) => {
  if (!encryptionKeyValidated) {
    encryptionKeyValidated = true;
    if (c.env.ENCRYPTION_KEY) {
      const err = validateEncryptionKey(c.env.ENCRYPTION_KEY);
      if (err) console.error(`[startup] ${err}`);
    }
  }
  return next();
});

// CORS — strict same-origin in production, localhost in dev
app.use("/api/*", async (c, next) => {
  const origin = c.req.header("Origin") || "";
  const host = c.req.header("Host") || "";
  if (!origin) return cors({ origin: `https://${host}` })(c, next);
  try {
    const originHost = new URL(origin).hostname;
    const isSameOrigin = originHost === host || originHost === host.split(":")[0];
    const isLocalDev = originHost === "localhost" || originHost === "127.0.0.1";
    if (isSameOrigin || isLocalDev) {
      return cors({ origin })(c, next);
    }
  } catch {
    // Malformed origin — reject
  }
  return next();
});

// Auth middleware — protect mutating endpoints with API_TOKEN
app.use("/api/sync/*", authMiddleware);
app.use("/api/import/*", authMiddleware);
app.use("/api/settings/*", authMiddleware);
app.use("/api/debug/*", authMiddleware);

// LLM routes: only protect mutating endpoints (POST/DELETE), not read-only GETs
app.on(["POST", "DELETE"], "/api/llm/*", authMiddleware);

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

  // Cron Trigger handler — staggered sync steps
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(runScheduledSync(event.cron, env));
  },
};

async function runScheduledSync(cron: string, env: Env): Promise<void> {
  const {
    triggerSCWikiSync,
    triggerImageSync,
    triggerPaintSync,
    triggerRSISync,
  } = await import("./sync/pipeline");

  switch (cron) {
    case "0 3 * * *":
      console.log("[cron] SC Wiki sync");
      await triggerSCWikiSync(env);
      break;
    case "15 3 * * *":
      console.log("[cron] FleetYards ship images");
      await triggerImageSync(env);
      break;
    case "30 3 * * *":
      console.log("[cron] Paint sync (scunpacked + FleetYards paint images)");
      await triggerPaintSync(env);
      break;
    case "45 3 * * *":
      console.log("[cron] RSI API images");
      await triggerRSISync(env);
      break;
    default:
      console.warn(`[cron] Unknown schedule: ${cron}`);
  }
}

async function authMiddleware(c: Context<HonoEnv>, next: Next): Promise<Response | void> {
  const token = c.env.API_TOKEN;
  if (!token) {
    // No API_TOKEN configured — allow all requests (dev mode)
    return next();
  }
  // Same-origin browser requests are trusted (SPA served by same Worker).
  // Sec-Fetch-Site is a forbidden header — browsers set it automatically and
  // JavaScript cannot override it, so "same-origin" is reliable proof the
  // request came from our own SPA.
  if (c.req.header("Sec-Fetch-Site") === "same-origin") {
    return next();
  }
  const provided = c.req.header("X-API-Key") || c.req.query("token") || "";
  const encoder = new TextEncoder();
  const a = encoder.encode(provided);
  const b = encoder.encode(token);
  // Constant-time comparison — prevent timing side-channel attacks
  if (a.byteLength !== b.byteLength || !crypto.subtle.timingSafeEqual(a, b)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
}
