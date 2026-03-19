import { Hono } from "hono";
import { z } from "zod";
import type { HonoEnv } from "../lib/types";
import { validate } from "../lib/validation";
import { logEvent } from "../lib/logger";

const companion = new Hono<HonoEnv>();

// --- Schemas ---

const CompanionEventSchema = z.object({
  type: z.string().min(1).max(100),
  source: z.enum(["log", "grpc"]),
  timestamp: z.string().max(50),
  data: z.record(z.string().max(200), z.string().max(1000)).default({}),
});

const EventBatchSchema = z.object({
  events: z.array(CompanionEventSchema).min(1).max(500),
});

const HeartbeatSchema = z.object({
  player_handle: z.string().max(100).optional(),
  current_ship: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  jurisdiction: z.string().max(200).optional(),
  event_count: z.coerce.number().int().min(0).optional(),
  companion_version: z.string().max(20).optional(),
});

// --- Middleware: require authenticated user ---

companion.use("*", async (c, next) => {
  const user = c.get("user" as never) as { id: string } | undefined;
  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }
  return next();
});

// --- Routes ---

/**
 * POST /api/companion/events
 * Receive a batch of game events from the companion app.
 * Stored against the authenticated user for analytics and history.
 */
companion.post("/events", validate("json", EventBatchSchema), async (c) => {
  const user = c.get("user" as never) as { id: string };
  const { events } = c.req.valid("json" as never) as z.infer<typeof EventBatchSchema>;

  const db = c.env.DB;
  const now = new Date().toISOString();

  // Batch insert events
  const stmts = events.map((evt) =>
    db
      .prepare(
        `INSERT INTO companion_events (user_id, type, source, event_timestamp, data_json, received_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(user.id, evt.type, evt.source, evt.timestamp, JSON.stringify(evt.data), now)
  );

  // D1 batch limit is 100 statements
  for (let i = 0; i < stmts.length; i += 100) {
    const batch = stmts.slice(i, i + 100);
    await db.batch(batch);
  }

  logEvent("companion_events_received", {
    user_id: user.id,
    count: events.length,
    types: [...new Set(events.map((e) => e.type))].join(","),
  });

  return c.json({ ok: true, stored: events.length });
});

/**
 * POST /api/companion/heartbeat
 * Update the user's live game state (shown on profile, org dashboard, etc.)
 */
companion.post("/heartbeat", validate("json", HeartbeatSchema), async (c) => {
  const user = c.get("user" as never) as { id: string };
  const state = c.req.valid("json" as never) as z.infer<typeof HeartbeatSchema>;

  const db = c.env.DB;

  await db
    .prepare(
      `INSERT INTO companion_status (user_id, player_handle, current_ship, location, jurisdiction, event_count, companion_version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         player_handle = excluded.player_handle,
         current_ship = excluded.current_ship,
         location = excluded.location,
         jurisdiction = excluded.jurisdiction,
         event_count = excluded.event_count,
         companion_version = excluded.companion_version,
         updated_at = excluded.updated_at`
    )
    .bind(
      user.id,
      state.player_handle ?? null,
      state.current_ship ?? null,
      state.location ?? null,
      state.jurisdiction ?? null,
      state.event_count ?? 0,
      state.companion_version ?? null
    )
    .run();

  return c.json({ ok: true });
});

/**
 * GET /api/companion/status
 * Get the user's current companion status.
 */
companion.get("/status", async (c) => {
  const user = c.get("user" as never) as { id: string };
  const db = c.env.DB;

  const status = await db
    .prepare("SELECT * FROM companion_status WHERE user_id = ?")
    .bind(user.id)
    .first();

  return c.json({ ok: true, status: status ?? null });
});

/**
 * GET /api/companion/events/summary
 * Get event type counts for the authenticated user.
 */
companion.get("/events/summary", async (c) => {
  const user = c.get("user" as never) as { id: string };
  const db = c.env.DB;

  const rows = await db
    .prepare(
      `SELECT type, COUNT(*) as count, MAX(event_timestamp) as latest
       FROM companion_events
       WHERE user_id = ?
       GROUP BY type
       ORDER BY count DESC`
    )
    .bind(user.id)
    .all();

  const total = await db
    .prepare("SELECT COUNT(*) as total FROM companion_events WHERE user_id = ?")
    .bind(user.id)
    .first<{ total: number }>();

  return c.json({
    ok: true,
    total: total?.total ?? 0,
    types: rows.results,
  });
});

/**
 * GET /api/companion/events/recent
 * Get recent events for the authenticated user.
 */
companion.get("/events/recent", async (c) => {
  const user = c.get("user" as never) as { id: string };
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const db = c.env.DB;

  const rows = await db
    .prepare(
      `SELECT type, source, event_timestamp, data_json
       FROM companion_events
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT ?`
    )
    .bind(user.id, limit)
    .all();

  return c.json({
    ok: true,
    events: rows.results.map((r: Record<string, unknown>) => ({
      type: r.type,
      source: r.source,
      timestamp: r.event_timestamp,
      data: JSON.parse(r.data_json as string),
    })),
  });
});

export function companionRoutes() {
  return companion;
}
