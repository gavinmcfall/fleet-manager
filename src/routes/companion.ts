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

// --- gRPC sync schemas ---

const WalletSyncSchema = z.object({
  auec: z.number().int().min(0),
  uec: z.number().int().min(0).default(0),
  rec: z.number().int().min(0).default(0),
  mer: z.number().int().min(0).default(0),
  captured_at: z.string().max(50),
});

const FriendSchema = z.object({
  account_id: z.string().min(1).max(100),
  nickname: z.string().max(200).optional(),
  display_name: z.string().max(200).optional(),
  presence: z.string().max(50).default("offline"),
  activity_state: z.string().max(100).optional(),
  activity_detail: z.string().max(500).optional(),
});

const FriendsSyncSchema = z.object({
  friends: z.array(FriendSchema).max(500),
});

const ReputationScoreSchema = z.object({
  entity_id: z.string().min(1).max(200),
  scope: z.string().max(100).default("default"),
  score: z.number().int(),
  standing_tier: z.string().max(100).optional(),
  standings_id: z.string().max(100).optional(),
  standing_id: z.string().max(100).optional(),
  drift: z.number().optional(),
});

const ReputationHistoryEntrySchema = z.object({
  entity_id: z.string().min(1).max(200),
  scope: z.string().max(100).default("default"),
  score: z.number().int(),
  event_timestamp: z.string().max(50),
});

const ReputationSyncSchema = z.object({
  scores: z.array(ReputationScoreSchema).max(200),
  history: z.array(ReputationHistoryEntrySchema).max(2000).default([]),
  captured_at: z.string().max(50),
});

const BlueprintSchema = z.object({
  blueprint_id: z.string().min(1).max(200),
  category_id: z.string().max(200).optional(),
  item_class_id: z.string().max(200).optional(),
  tier: z.number().int().optional(),
  remaining_uses: z.number().int().default(-1),
  source: z.string().max(50).default("GAMEPLAY"),
  process_type: z.string().max(100).optional(),
});

const BlueprintsSyncSchema = z.object({
  blueprints: z.array(BlueprintSchema).max(1000),
});

const EntitlementSchema = z.object({
  urn: z.string().min(1).max(500),
  name: z.string().max(500).optional(),
  entity_class_guid: z.string().max(100).optional(),
  entitlement_type: z.string().max(50).default("PERMANENT"),
  status: z.string().max(50).optional(),
  item_type: z.string().max(100).optional(),
  source: z.string().max(100).optional(),
  insurance_lifetime: z.number().int().default(0),
  insurance_duration: z.number().int().optional(),
});

const EntitlementsSyncSchema = z.object({
  entitlements: z.array(EntitlementSchema).max(500),
});

const MissionSchema = z.object({
  mission_id: z.string().min(1).max(200),
  contract_id: z.string().max(200).optional(),
  template: z.string().max(200).optional(),
  state: z.string().max(50).default("PENDING"),
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  reward_auec: z.number().int().optional(),
  expires_at: z.string().max(50).optional(),
  objectives_json: z.string().max(10000).optional(),
});

const MissionsSyncSchema = z.object({
  missions: z.array(MissionSchema).max(100),
  captured_at: z.string().max(50),
});

const StatSchema = z.object({
  stat_def_id: z.string().min(1).max(200),
  value: z.number(),
  best: z.number().optional(),
  category: z.string().max(100).optional(),
  game_mode: z.string().max(100).optional(),
});

const StatsSyncSchema = z.object({
  stats: z.array(StatSchema).max(500),
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

// ============================================================
// gRPC Sync POST endpoints — data from companion app
// ============================================================

/** Helper: upsert sync_log after each sync */
async function updateSyncLog(
  db: D1Database,
  userId: string,
  dataType: string,
  count: number,
  error?: string,
) {
  await db
    .prepare(
      `INSERT INTO companion_sync_log (user_id, data_type, status, item_count, error, synced_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, data_type) DO UPDATE SET
         status = excluded.status,
         item_count = excluded.item_count,
         error = excluded.error,
         synced_at = excluded.synced_at`,
    )
    .bind(userId, dataType, error ? "error" : "success", count, error ?? null)
    .run();
}

/**
 * POST /api/companion/sync/wallet
 * Append wallet snapshot (dedup if identical within 1 min), upsert current.
 */
companion.post("/sync/wallet", validate("json", WalletSyncSchema), async (c) => {
  const user = c.get("user" as never) as { id: string };
  const data = c.req.valid("json" as never) as z.infer<typeof WalletSyncSchema>;
  const db = c.env.DB;

  // Dedup: skip if most recent snapshot has identical values within same minute
  const recent = await db
    .prepare(
      `SELECT auec, uec, rec, mer, captured_at FROM companion_wallet_snapshots
       WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
    )
    .bind(user.id)
    .first<{ auec: number; uec: number; rec: number; mer: number; captured_at: string }>();

  let snapshotInserted = false;
  if (
    !recent ||
    recent.auec !== data.auec ||
    recent.uec !== data.uec ||
    recent.rec !== data.rec ||
    recent.mer !== data.mer ||
    recent.captured_at.slice(0, 16) !== data.captured_at.slice(0, 16)
  ) {
    await db
      .prepare(
        `INSERT INTO companion_wallet_snapshots (user_id, auec, uec, rec, mer, captured_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(user.id, data.auec, data.uec, data.rec, data.mer, data.captured_at)
      .run();
    snapshotInserted = true;
  }

  // Upsert current
  await db
    .prepare(
      `INSERT INTO companion_wallet_current (user_id, auec, uec, rec, mer, captured_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         auec = excluded.auec, uec = excluded.uec, rec = excluded.rec, mer = excluded.mer,
         captured_at = excluded.captured_at, updated_at = excluded.updated_at`,
    )
    .bind(user.id, data.auec, data.uec, data.rec, data.mer, data.captured_at)
    .run();

  await updateSyncLog(db, user.id, "wallet", 1);

  return c.json({ ok: true, synced: 1, snapshot: snapshotInserted });
});

/**
 * POST /api/companion/sync/friends
 * Upsert each friend by (user_id, account_id).
 */
companion.post("/sync/friends", validate("json", FriendsSyncSchema), async (c) => {
  const user = c.get("user" as never) as { id: string };
  const { friends } = c.req.valid("json" as never) as z.infer<typeof FriendsSyncSchema>;
  const db = c.env.DB;

  const stmts = friends.map((f) =>
    db
      .prepare(
        `INSERT INTO companion_friends (user_id, account_id, nickname, display_name, presence, activity_state, activity_detail, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id, account_id) DO UPDATE SET
           nickname = excluded.nickname, display_name = excluded.display_name,
           presence = excluded.presence, activity_state = excluded.activity_state,
           activity_detail = excluded.activity_detail, updated_at = excluded.updated_at`,
      )
      .bind(
        user.id,
        f.account_id,
        f.nickname ?? null,
        f.display_name ?? null,
        f.presence,
        f.activity_state ?? null,
        f.activity_detail ?? null,
      ),
  );

  for (let i = 0; i < stmts.length; i += 50) {
    await db.batch(stmts.slice(i, i + 50));
  }

  await updateSyncLog(db, user.id, "friends", friends.length);

  return c.json({ ok: true, synced: friends.length });
});

/**
 * POST /api/companion/sync/reputation
 * Upsert scores, append history entries.
 */
companion.post("/sync/reputation", validate("json", ReputationSyncSchema), async (c) => {
  const user = c.get("user" as never) as { id: string };
  const data = c.req.valid("json" as never) as z.infer<typeof ReputationSyncSchema>;
  const db = c.env.DB;

  // Upsert scores
  const scoreStmts = data.scores.map((s) =>
    db
      .prepare(
        `INSERT INTO companion_reputation_scores (user_id, entity_id, scope, score, standing_tier, standings_id, standing_id, drift, captured_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id, entity_id, scope) DO UPDATE SET
           score = excluded.score, standing_tier = excluded.standing_tier,
           standings_id = excluded.standings_id, standing_id = excluded.standing_id,
           drift = excluded.drift, captured_at = excluded.captured_at, updated_at = excluded.updated_at`,
      )
      .bind(
        user.id,
        s.entity_id,
        s.scope,
        s.score,
        s.standing_tier ?? null,
        s.standings_id ?? null,
        s.standing_id ?? null,
        s.drift ?? null,
        data.captured_at,
      ),
  );

  for (let i = 0; i < scoreStmts.length; i += 50) {
    await db.batch(scoreStmts.slice(i, i + 50));
  }

  // Append history (UNIQUE prevents dups)
  const histStmts = data.history.map((h) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO companion_reputation_history (user_id, entity_id, scope, score, event_timestamp)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(user.id, h.entity_id, h.scope, h.score, h.event_timestamp),
  );

  for (let i = 0; i < histStmts.length; i += 50) {
    await db.batch(histStmts.slice(i, i + 50));
  }

  await updateSyncLog(db, user.id, "reputation", data.scores.length);

  return c.json({ ok: true, synced: data.scores.length, history: data.history.length });
});

/**
 * POST /api/companion/sync/blueprints
 * Full replace — DELETE + INSERT.
 */
companion.post("/sync/blueprints", validate("json", BlueprintsSyncSchema), async (c) => {
  const user = c.get("user" as never) as { id: string };
  const { blueprints } = c.req.valid("json" as never) as z.infer<typeof BlueprintsSyncSchema>;
  const db = c.env.DB;

  // Delete existing
  await db.prepare("DELETE FROM companion_blueprints WHERE user_id = ?").bind(user.id).run();

  // Insert new
  const stmts = blueprints.map((bp) =>
    db
      .prepare(
        `INSERT INTO companion_blueprints (user_id, blueprint_id, category_id, item_class_id, tier, remaining_uses, source, process_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        user.id,
        bp.blueprint_id,
        bp.category_id ?? null,
        bp.item_class_id ?? null,
        bp.tier ?? null,
        bp.remaining_uses,
        bp.source,
        bp.process_type ?? null,
      ),
  );

  for (let i = 0; i < stmts.length; i += 50) {
    await db.batch(stmts.slice(i, i + 50));
  }

  await updateSyncLog(db, user.id, "blueprints", blueprints.length);

  return c.json({ ok: true, synced: blueprints.length });
});

/**
 * POST /api/companion/sync/entitlements
 * Upsert by (user_id, urn). Resolves vehicle_id from entity_class_guid.
 */
companion.post("/sync/entitlements", validate("json", EntitlementsSyncSchema), async (c) => {
  const user = c.get("user" as never) as { id: string };
  const { entitlements } = c.req.valid("json" as never) as z.infer<typeof EntitlementsSyncSchema>;
  const db = c.env.DB;

  // Batch-resolve entity_class_guid → vehicle_id
  const guids = entitlements
    .map((e) => e.entity_class_guid)
    .filter((g): g is string => !!g);

  const guidToVehicleId = new Map<string, number>();
  if (guids.length > 0) {
    // Query in chunks to avoid query size limits
    for (let i = 0; i < guids.length; i += 50) {
      const chunk = guids.slice(i, i + 50);
      const placeholders = chunk.map(() => "?").join(",");
      const rows = await db
        .prepare(`SELECT id, uuid FROM vehicles WHERE uuid IN (${placeholders})`)
        .bind(...chunk)
        .all<{ id: number; uuid: string }>();
      for (const row of rows.results) {
        guidToVehicleId.set(row.uuid, row.id);
      }
    }
  }

  const stmts = entitlements.map((e) => {
    const vehicleId = e.entity_class_guid ? guidToVehicleId.get(e.entity_class_guid) ?? null : null;
    return db
      .prepare(
        `INSERT INTO companion_entitlements (user_id, urn, name, entity_class_guid, entitlement_type, status, item_type, source, insurance_lifetime, insurance_duration, vehicle_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id, urn) DO UPDATE SET
           name = excluded.name, entity_class_guid = excluded.entity_class_guid,
           entitlement_type = excluded.entitlement_type, status = excluded.status,
           item_type = excluded.item_type, source = excluded.source,
           insurance_lifetime = excluded.insurance_lifetime, insurance_duration = excluded.insurance_duration,
           vehicle_id = excluded.vehicle_id, updated_at = excluded.updated_at`,
      )
      .bind(
        user.id,
        e.urn,
        e.name ?? null,
        e.entity_class_guid ?? null,
        e.entitlement_type,
        e.status ?? null,
        e.item_type ?? null,
        e.source ?? null,
        e.insurance_lifetime,
        e.insurance_duration ?? null,
        vehicleId,
      );
  });

  for (let i = 0; i < stmts.length; i += 50) {
    await db.batch(stmts.slice(i, i + 50));
  }

  await updateSyncLog(db, user.id, "entitlements", entitlements.length);

  return c.json({ ok: true, synced: entitlements.length });
});

/**
 * POST /api/companion/sync/missions
 * Upsert by (user_id, mission_id). Keeps completed missions for history.
 */
companion.post("/sync/missions", validate("json", MissionsSyncSchema), async (c) => {
  const user = c.get("user" as never) as { id: string };
  const data = c.req.valid("json" as never) as z.infer<typeof MissionsSyncSchema>;
  const db = c.env.DB;

  const stmts = data.missions.map((m) =>
    db
      .prepare(
        `INSERT INTO companion_missions (user_id, mission_id, contract_id, template, state, title, description, reward_auec, expires_at, objectives_json, captured_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id, mission_id) DO UPDATE SET
           contract_id = excluded.contract_id, template = excluded.template,
           state = excluded.state, title = excluded.title, description = excluded.description,
           reward_auec = excluded.reward_auec, expires_at = excluded.expires_at,
           objectives_json = excluded.objectives_json, captured_at = excluded.captured_at,
           updated_at = excluded.updated_at`,
      )
      .bind(
        user.id,
        m.mission_id,
        m.contract_id ?? null,
        m.template ?? null,
        m.state,
        m.title ?? null,
        m.description ?? null,
        m.reward_auec ?? null,
        m.expires_at ?? null,
        m.objectives_json ?? null,
        data.captured_at,
      ),
  );

  for (let i = 0; i < stmts.length; i += 50) {
    await db.batch(stmts.slice(i, i + 50));
  }

  await updateSyncLog(db, user.id, "missions", data.missions.length);

  return c.json({ ok: true, synced: data.missions.length });
});

/**
 * POST /api/companion/sync/stats
 * Upsert by (user_id, stat_def_id, game_mode).
 */
companion.post("/sync/stats", validate("json", StatsSyncSchema), async (c) => {
  const user = c.get("user" as never) as { id: string };
  const { stats } = c.req.valid("json" as never) as z.infer<typeof StatsSyncSchema>;
  const db = c.env.DB;

  const stmts = stats.map((s) =>
    db
      .prepare(
        `INSERT INTO companion_stats (user_id, stat_def_id, value, best, category, game_mode, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id, stat_def_id, game_mode) DO UPDATE SET
           value = excluded.value, best = MAX(companion_stats.best, excluded.best),
           category = excluded.category, updated_at = excluded.updated_at`,
      )
      .bind(
        user.id,
        s.stat_def_id,
        s.value,
        s.best ?? null,
        s.category ?? null,
        s.game_mode ?? null,
      ),
  );

  for (let i = 0; i < stmts.length; i += 50) {
    await db.batch(stmts.slice(i, i + 50));
  }

  await updateSyncLog(db, user.id, "stats", stats.length);

  return c.json({ ok: true, synced: stats.length });
});

// ============================================================
// gRPC Sync GET endpoints — read data for website/companion UI
// ============================================================

/**
 * GET /api/companion/wallet/current
 * Latest wallet balance.
 */
companion.get("/wallet/current", async (c) => {
  const user = c.get("user" as never) as { id: string };
  const db = c.env.DB;

  const wallet = await db
    .prepare("SELECT auec, uec, rec, mer, captured_at, updated_at FROM companion_wallet_current WHERE user_id = ?")
    .bind(user.id)
    .first();

  return c.json({ ok: true, wallet: wallet ?? null });
});

/**
 * GET /api/companion/wallet/history?days=7
 * Wallet snapshots for charting.
 */
companion.get("/wallet/history", async (c) => {
  const user = c.get("user" as never) as { id: string };
  const days = Math.min(Math.max(Number(c.req.query("days") ?? 7), 1), 90);
  const db = c.env.DB;

  const rows = await db
    .prepare(
      `SELECT auec, uec, rec, mer, captured_at FROM companion_wallet_snapshots
       WHERE user_id = ? AND captured_at >= datetime('now', '-' || ? || ' days')
       ORDER BY captured_at ASC`,
    )
    .bind(user.id, days)
    .all();

  return c.json({ ok: true, snapshots: rows.results });
});

/**
 * GET /api/companion/friends
 * Friends with presence.
 */
companion.get("/friends", async (c) => {
  const user = c.get("user" as never) as { id: string };
  const db = c.env.DB;

  const rows = await db
    .prepare(
      `SELECT account_id, nickname, display_name, presence, activity_state, activity_detail, updated_at
       FROM companion_friends WHERE user_id = ? ORDER BY presence DESC, nickname ASC`,
    )
    .bind(user.id)
    .all();

  return c.json({ ok: true, friends: rows.results });
});

/**
 * GET /api/companion/reputation
 * Current reputation scores.
 */
companion.get("/reputation", async (c) => {
  const user = c.get("user" as never) as { id: string };
  const db = c.env.DB;

  const rows = await db
    .prepare(
      `SELECT cr.entity_id, cr.scope, cr.score, cr.standing_tier, cr.standings_id, cr.standing_id,
              cr.drift, cr.captured_at,
              rs.name AS scope_name,
              rst.name AS standing_name, rst.min_reputation
       FROM companion_reputation_scores cr
       LEFT JOIN reputation_scopes rs ON rs.uuid = cr.standings_id
       LEFT JOIN reputation_standings rst ON rst.uuid = cr.standing_id
       WHERE cr.user_id = ?
       ORDER BY cr.scope ASC`,
    )
    .bind(user.id)
    .all();

  return c.json({ ok: true, scores: rows.results });
});

/**
 * GET /api/companion/reputation/history?entity_id=X&scope=default
 * Score history for a specific entity (for charting).
 */
companion.get("/reputation/history", async (c) => {
  const user = c.get("user" as never) as { id: string };
  const entityId = c.req.query("entity_id");
  if (!entityId) return c.json({ error: "entity_id required" }, 400);
  const scope = c.req.query("scope") ?? "default";
  const db = c.env.DB;

  const rows = await db
    .prepare(
      `SELECT score, event_timestamp FROM companion_reputation_history
       WHERE user_id = ? AND entity_id = ? AND scope = ?
       ORDER BY event_timestamp ASC LIMIT 1000`,
    )
    .bind(user.id, entityId, scope)
    .all();

  return c.json({ ok: true, history: rows.results });
});

/**
 * GET /api/companion/blueprints
 * Blueprint collection.
 */
companion.get("/blueprints", async (c) => {
  const user = c.get("user" as never) as { id: string };
  const db = c.env.DB;

  const rows = await db
    .prepare(
      `SELECT blueprint_id, category_id, item_class_id, tier, remaining_uses, source, process_type, updated_at
       FROM companion_blueprints WHERE user_id = ? ORDER BY category_id, tier DESC`,
    )
    .bind(user.id)
    .all();

  return c.json({ ok: true, blueprints: rows.results });
});

/**
 * GET /api/companion/entitlements
 * Entitlements with vehicle JOIN.
 */
companion.get("/entitlements", async (c) => {
  const user = c.get("user" as never) as { id: string };
  const db = c.env.DB;

  const rows = await db
    .prepare(
      `SELECT e.urn, e.name, e.entity_class_guid, e.entitlement_type, e.status, e.item_type,
              e.source, e.insurance_lifetime, e.insurance_duration, e.vehicle_id, e.updated_at,
              v.name AS vehicle_name, v.slug AS vehicle_slug
       FROM companion_entitlements e
       LEFT JOIN vehicles v ON v.id = e.vehicle_id
       WHERE e.user_id = ?
       ORDER BY e.name ASC`,
    )
    .bind(user.id)
    .all();

  return c.json({ ok: true, entitlements: rows.results });
});

/**
 * GET /api/companion/missions?state=ACTIVE
 * Active + recent missions.
 */
companion.get("/missions", async (c) => {
  const user = c.get("user" as never) as { id: string };
  const state = c.req.query("state");
  const db = c.env.DB;

  let sql = `SELECT mission_id, contract_id, template, state, title, description,
                    reward_auec, expires_at, objectives_json, captured_at, updated_at
             FROM companion_missions WHERE user_id = ?`;
  const binds: unknown[] = [user.id];

  if (state) {
    sql += " AND state = ?";
    binds.push(state);
  }

  sql += " ORDER BY updated_at DESC LIMIT 200";

  const rows = await db
    .prepare(sql)
    .bind(...binds)
    .all();

  return c.json({
    ok: true,
    missions: rows.results.map((r: Record<string, unknown>) => ({
      ...r,
      objectives: r.objectives_json ? JSON.parse(r.objectives_json as string) : null,
      objectives_json: undefined,
    })),
  });
});

/**
 * GET /api/companion/stats
 * Player stats.
 */
companion.get("/stats", async (c) => {
  const user = c.get("user" as never) as { id: string };
  const category = c.req.query("category");
  const db = c.env.DB;

  let sql = `SELECT stat_def_id, value, best, category, game_mode, updated_at
             FROM companion_stats WHERE user_id = ?`;
  const binds: unknown[] = [user.id];

  if (category) {
    sql += " AND category = ?";
    binds.push(category);
  }

  sql += " ORDER BY category, stat_def_id";

  const rows = await db
    .prepare(sql)
    .bind(...binds)
    .all();

  return c.json({ ok: true, stats: rows.results });
});

/**
 * GET /api/companion/sync/status
 * Last sync time per data type.
 */
companion.get("/sync/status", async (c) => {
  const user = c.get("user" as never) as { id: string };
  const db = c.env.DB;

  const rows = await db
    .prepare(
      "SELECT data_type, status, item_count, error, synced_at FROM companion_sync_log WHERE user_id = ?",
    )
    .bind(user.id)
    .all();

  return c.json({ ok: true, sync: rows.results });
});

export function companionRoutes() {
  return companion;
}
