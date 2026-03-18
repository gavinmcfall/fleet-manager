import { Hono } from "hono";
import { z } from "zod";
import { getAuthUser, type HonoEnv } from "../lib/types";
import { validate } from "../lib/validation";
import { getOrgMembership, canManageOp } from "../lib/org-auth";
import { calculatePayouts, type ParticipantInput } from "../lib/ops-payout";

/**
 * /api/orgs/:slug/ops/* — Org Operations (mining runs, cargo hauls, etc.)
 *
 * Lifecycle: planning -> active -> completed -> archived
 *                             -> cancelled
 */
export function opsRoutes() {
  const routes = new Hono<HonoEnv>();

  // ── List ops ────────────────────────────────────────────────────────

  // GET /ops — list ops for an org (filter by status)
  routes.get("/", async (c) => {
    const user = getAuthUser(c);
    const slug = c.req.param("slug")!;
    const db = c.env.DB;
    const status = c.req.query("status");

    const ctx = await getOrgMembership(db, slug, user.id);
    if (!ctx) return c.json({ error: "Not found" }, 404);

    let query = `SELECT o.id, o.name, o.status, o.description, o.is_public,
        o.started_at, o.completed_at, o.created_at,
        ot.key as op_type, ot.label as op_type_label,
        u.name as creator_name,
        (SELECT COUNT(*) FROM org_op_participants p WHERE p.org_op_id = o.id AND p.left_at IS NULL) as participant_count
      FROM org_ops o
      JOIN op_types ot ON ot.id = o.op_type_id
      JOIN user u ON u.id = o.created_by
      WHERE o.org_id = ?`;
    const binds: unknown[] = [ctx.orgId];

    if (status) {
      query += " AND o.status = ?";
      binds.push(status);
    }
    query += " ORDER BY o.created_at DESC LIMIT 100";

    const { results } = await db.prepare(query).bind(...binds).all();
    return c.json({ ops: results });
  });

  // ── Create op ───────────────────────────────────────────────────────

  routes.post("/",
    validate("json", z.object({
      name: z.string().min(1).max(200),
      op_type: z.string().min(1).max(50),
      description: z.string().max(2000).nullable().optional(),
      webhook_url: z.string().url().max(500).nullable().optional(),
    })),
    async (c) => {
      const user = getAuthUser(c);
      const slug = c.req.param("slug")!;
      const db = c.env.DB;

      const ctx = await getOrgMembership(db, slug, user.id);
      if (!ctx) return c.json({ error: "Not found" }, 404);

      const body = c.req.valid("json");

      // Look up op_type
      const opType = await db
        .prepare("SELECT id FROM op_types WHERE key = ?")
        .bind(body.op_type)
        .first<{ id: number }>();
      if (!opType) return c.json({ error: "Invalid op type" }, 400);

      // Rate limit: max 5 active ops per org per user
      const activeCount = await db
        .prepare("SELECT COUNT(*) as cnt FROM org_ops WHERE org_id = ? AND created_by = ? AND status IN ('planning', 'active')")
        .bind(ctx.orgId, user.id)
        .first<{ cnt: number }>();
      if (activeCount && activeCount.cnt >= 5) {
        return c.json({ error: "Maximum 5 active ops per user" }, 429);
      }

      const { meta } = await db
        .prepare(
          `INSERT INTO org_ops (org_id, name, op_type_id, status, description, created_by, webhook_url)
           VALUES (?, ?, ?, 'planning', ?, ?, ?)`,
        )
        .bind(ctx.orgId, body.name, opType.id, body.description ?? null, user.id, body.webhook_url ?? null)
        .run();

      const opId = meta.last_row_id;

      // Auto-join creator as participant
      await db
        .prepare("INSERT INTO org_op_participants (org_op_id, user_id, role) VALUES (?, ?, 'leader')")
        .bind(opId, user.id)
        .run();

      return c.json({ ok: true, id: opId }, 201);
    },
  );

  // ── Op detail ───────────────────────────────────────────────────────

  routes.get("/:opId", async (c) => {
    const user = getAuthUser(c);
    const slug = c.req.param("slug")!;
    const opId = parseInt(c.req.param("opId"), 10);
    const db = c.env.DB;

    const ctx = await getOrgMembership(db, slug, user.id);
    if (!ctx) return c.json({ error: "Not found" }, 404);

    const op = await db
      .prepare(
        `SELECT o.*, ot.key as op_type, ot.label as op_type_label,
          u.name as creator_name
        FROM org_ops o
        JOIN op_types ot ON ot.id = o.op_type_id
        JOIN user u ON u.id = o.created_by
        WHERE o.id = ? AND o.org_id = ?`,
      )
      .bind(opId, ctx.orgId)
      .first();
    if (!op) return c.json({ error: "Not found" }, 404);

    // Fetch participants, ships, earnings, capital, payouts in parallel
    const [participants, ships, earnings, capital, payouts] = await Promise.all([
      db.prepare(
        `SELECT p.*, u.name as user_name, u.image as user_image
         FROM org_op_participants p
         JOIN user u ON u.id = p.user_id
         WHERE p.org_op_id = ?
         ORDER BY p.joined_at`,
      ).bind(opId).all(),
      db.prepare(
        `SELECT s.*, uf.custom_name, v.name as vehicle_name, v.slug as vehicle_slug,
          v.image_url, v.focus, v.size_label,
          m.name as manufacturer_name,
          u.name as owner_name
         FROM org_op_ships s
         JOIN user_fleet uf ON uf.id = s.user_fleet_id
         JOIN vehicles v ON v.id = uf.vehicle_id
         LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
         JOIN user u ON u.id = s.owner_user_id
         WHERE s.org_op_id = ?`,
      ).bind(opId).all(),
      db.prepare(
        `SELECT e.*, u.name as logged_by_name
         FROM org_op_earnings e
         JOIN user u ON u.id = e.logged_by
         WHERE e.org_op_id = ?
         ORDER BY e.created_at`,
      ).bind(opId).all(),
      db.prepare(
        `SELECT cap.*, u.name as user_name
         FROM org_op_capital cap
         JOIN user u ON u.id = cap.user_id
         WHERE cap.org_op_id = ?
         ORDER BY cap.created_at`,
      ).bind(opId).all(),
      db.prepare(
        `SELECT p.*, u.name as user_name
         FROM org_op_payouts p
         JOIN user u ON u.id = p.user_id
         WHERE p.org_op_id = ?
         ORDER BY p.amount DESC`,
      ).bind(opId).all(),
    ]);

    return c.json({
      op,
      participants: participants.results,
      ships: ships.results,
      earnings: earnings.results,
      capital: capital.results,
      payouts: payouts.results,
      callerRole: ctx.role,
    });
  });

  // ── Update op ───────────────────────────────────────────────────────

  routes.patch("/:opId",
    validate("json", z.object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).nullable().optional(),
      status: z.enum(["planning", "active", "completed", "cancelled", "archived"]).optional(),
      webhook_url: z.string().url().max(500).nullable().optional(),
    }).strict()),
    async (c) => {
      const user = getAuthUser(c);
      const slug = c.req.param("slug")!;
      const opId = parseInt(c.req.param("opId"), 10);
      const db = c.env.DB;

      const ctx = await getOrgMembership(db, slug, user.id);
      if (!ctx) return c.json({ error: "Not found" }, 404);

      const op = await db
        .prepare("SELECT id, created_by, status FROM org_ops WHERE id = ? AND org_id = ?")
        .bind(opId, ctx.orgId)
        .first<{ id: number; created_by: string; status: string }>();
      if (!op) return c.json({ error: "Not found" }, 404);

      if (!canManageOp(ctx.role, user.id, op.created_by)) {
        return c.json({ error: "Forbidden" }, 403);
      }

      const body = c.req.valid("json");

      // Status transition validation
      if (body.status) {
        const validTransitions: Record<string, string[]> = {
          planning: ["active", "cancelled"],
          active: ["completed", "cancelled"],
          completed: ["archived"],
          cancelled: [],
          archived: [],
        };
        const allowed = validTransitions[op.status] ?? [];
        if (!allowed.includes(body.status)) {
          return c.json({ error: `Cannot transition from ${op.status} to ${body.status}` }, 400);
        }
      }

      const updates: string[] = [];
      const values: unknown[] = [];

      if (body.name !== undefined) { updates.push("name = ?"); values.push(body.name); }
      if (body.description !== undefined) { updates.push("description = ?"); values.push(body.description); }
      if (body.webhook_url !== undefined) { updates.push("webhook_url = ?"); values.push(body.webhook_url); }
      if (body.status !== undefined) {
        updates.push("status = ?");
        values.push(body.status);
        if (body.status === "active") {
          updates.push("started_at = datetime('now')");
        } else if (body.status === "completed" || body.status === "cancelled") {
          updates.push("completed_at = datetime('now')");
        }
      }
      updates.push("updated_at = datetime('now')");

      if (updates.length === 1) return c.json({ error: "No fields to update" }, 400);

      values.push(opId);
      await db
        .prepare(`UPDATE org_ops SET ${updates.join(", ")} WHERE id = ?`)
        .bind(...values)
        .run();

      return c.json({ ok: true });
    },
  );

  // ── Delete op (planning only) ──────────────────────────────────────

  routes.delete("/:opId", async (c) => {
    const user = getAuthUser(c);
    const slug = c.req.param("slug")!;
    const opId = parseInt(c.req.param("opId"), 10);
    const db = c.env.DB;

    const ctx = await getOrgMembership(db, slug, user.id);
    if (!ctx) return c.json({ error: "Not found" }, 404);

    const op = await db
      .prepare("SELECT id, created_by, status FROM org_ops WHERE id = ? AND org_id = ?")
      .bind(opId, ctx.orgId)
      .first<{ id: number; created_by: string; status: string }>();
    if (!op) return c.json({ error: "Not found" }, 404);

    if (!canManageOp(ctx.role, user.id, op.created_by)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    if (op.status !== "planning") {
      return c.json({ error: "Can only delete ops in planning status" }, 400);
    }

    await db.batch([
      db.prepare("DELETE FROM org_op_payouts WHERE org_op_id = ?").bind(opId),
      db.prepare("DELETE FROM org_op_earnings WHERE org_op_id = ?").bind(opId),
      db.prepare("DELETE FROM org_op_capital WHERE org_op_id = ?").bind(opId),
      db.prepare("DELETE FROM org_op_ships WHERE org_op_id = ?").bind(opId),
      db.prepare("DELETE FROM org_op_participants WHERE org_op_id = ?").bind(opId),
      db.prepare("DELETE FROM org_ops WHERE id = ?").bind(opId),
    ]);

    return c.json({ ok: true });
  });

  // ── Join / Leave ────────────────────────────────────────────────────

  routes.post("/:opId/join", async (c) => {
    const user = getAuthUser(c);
    const slug = c.req.param("slug")!;
    const opId = parseInt(c.req.param("opId"), 10);
    const db = c.env.DB;

    const ctx = await getOrgMembership(db, slug, user.id);
    if (!ctx) return c.json({ error: "Not found" }, 404);

    const op = await db
      .prepare("SELECT id, status FROM org_ops WHERE id = ? AND org_id = ?")
      .bind(opId, ctx.orgId)
      .first<{ id: number; status: string }>();
    if (!op) return c.json({ error: "Not found" }, 404);

    if (op.status !== "planning" && op.status !== "active") {
      return c.json({ error: "Can only join ops in planning or active status" }, 400);
    }

    try {
      await db
        .prepare("INSERT INTO org_op_participants (org_op_id, user_id) VALUES (?, ?)")
        .bind(opId, user.id)
        .run();
    } catch {
      return c.json({ error: "Already joined this op" }, 409);
    }

    return c.json({ ok: true });
  });

  routes.post("/:opId/leave", async (c) => {
    const user = getAuthUser(c);
    const slug = c.req.param("slug")!;
    const opId = parseInt(c.req.param("opId"), 10);
    const db = c.env.DB;

    const ctx = await getOrgMembership(db, slug, user.id);
    if (!ctx) return c.json({ error: "Not found" }, 404);

    const op = await db
      .prepare("SELECT id, status, created_by FROM org_ops WHERE id = ? AND org_id = ?")
      .bind(opId, ctx.orgId)
      .first<{ id: number; status: string; created_by: string }>();
    if (!op) return c.json({ error: "Not found" }, 404);

    // Creator cannot leave their own op
    if (op.created_by === user.id) {
      return c.json({ error: "Op creator cannot leave — cancel the op instead" }, 400);
    }

    if (op.status === "active") {
      // During active: mark left_at instead of deleting
      await db
        .prepare("UPDATE org_op_participants SET left_at = datetime('now'), logged_off = 1 WHERE org_op_id = ? AND user_id = ?")
        .bind(opId, user.id)
        .run();
    } else {
      // During planning: remove entirely
      await db
        .prepare("DELETE FROM org_op_participants WHERE org_op_id = ? AND user_id = ?")
        .bind(opId, user.id)
        .run();
      // Also remove any ships they added
      await db
        .prepare("DELETE FROM org_op_ships WHERE org_op_id = ? AND owner_user_id = ?")
        .bind(opId, user.id)
        .run();
    }

    return c.json({ ok: true });
  });

  // ── Ships ───────────────────────────────────────────────────────────

  routes.post("/:opId/ships",
    validate("json", z.object({
      user_fleet_id: z.number().int().positive(),
      role: z.string().max(100).nullable().optional(),
    })),
    async (c) => {
      const user = getAuthUser(c);
      const slug = c.req.param("slug")!;
      const opId = parseInt(c.req.param("opId"), 10);
      const db = c.env.DB;

      const ctx = await getOrgMembership(db, slug, user.id);
      if (!ctx) return c.json({ error: "Not found" }, 404);

      // Must be a participant
      const participant = await db
        .prepare("SELECT id FROM org_op_participants WHERE org_op_id = ? AND user_id = ? AND left_at IS NULL")
        .bind(opId, user.id)
        .first();
      if (!participant) return c.json({ error: "You must be a participant to add ships" }, 403);

      const body = c.req.valid("json");

      // Verify user owns this fleet entry
      const fleetEntry = await db
        .prepare("SELECT id FROM user_fleet WHERE id = ? AND user_id = ?")
        .bind(body.user_fleet_id, user.id)
        .first();
      if (!fleetEntry) return c.json({ error: "Ship not found in your fleet" }, 404);

      try {
        await db
          .prepare("INSERT INTO org_op_ships (org_op_id, user_fleet_id, owner_user_id, role) VALUES (?, ?, ?, ?)")
          .bind(opId, body.user_fleet_id, user.id, body.role ?? null)
          .run();
      } catch {
        return c.json({ error: "Ship already added to this op" }, 409);
      }

      return c.json({ ok: true });
    },
  );

  routes.delete("/:opId/ships/:shipId", async (c) => {
    const user = getAuthUser(c);
    const slug = c.req.param("slug")!;
    const opId = parseInt(c.req.param("opId"), 10);
    const shipId = parseInt(c.req.param("shipId"), 10);
    const db = c.env.DB;

    const ctx = await getOrgMembership(db, slug, user.id);
    if (!ctx) return c.json({ error: "Not found" }, 404);

    const ship = await db
      .prepare("SELECT id, owner_user_id FROM org_op_ships WHERE id = ? AND org_op_id = ?")
      .bind(shipId, opId)
      .first<{ id: number; owner_user_id: string }>();
    if (!ship) return c.json({ error: "Not found" }, 404);

    // Ship owner or op admin can remove
    const op = await db
      .prepare("SELECT created_by FROM org_ops WHERE id = ?")
      .bind(opId)
      .first<{ created_by: string }>();
    if (ship.owner_user_id !== user.id && (!op || !canManageOp(ctx.role, user.id, op.created_by))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await db.prepare("DELETE FROM org_op_ships WHERE id = ?").bind(shipId).run();
    return c.json({ ok: true });
  });

  // ── Earnings ────────────────────────────────────────────────────────

  routes.post("/:opId/earnings",
    validate("json", z.object({
      amount: z.number().int().min(1).max(999_999_999),
      currency: z.string().max(10).default("aUEC"),
      note: z.string().max(500).nullable().optional(),
    })),
    async (c) => {
      const user = getAuthUser(c);
      const slug = c.req.param("slug")!;
      const opId = parseInt(c.req.param("opId"), 10);
      const db = c.env.DB;

      const ctx = await getOrgMembership(db, slug, user.id);
      if (!ctx) return c.json({ error: "Not found" }, 404);

      // Must be a participant
      const participant = await db
        .prepare("SELECT id FROM org_op_participants WHERE org_op_id = ? AND user_id = ? AND left_at IS NULL")
        .bind(opId, user.id)
        .first();
      if (!participant) return c.json({ error: "Must be a participant" }, 403);

      const op = await db
        .prepare("SELECT status FROM org_ops WHERE id = ? AND org_id = ?")
        .bind(opId, ctx.orgId)
        .first<{ status: string }>();
      if (!op || op.status !== "active") {
        return c.json({ error: "Can only log earnings for active ops" }, 400);
      }

      const body = c.req.valid("json");
      await db
        .prepare("INSERT INTO org_op_earnings (org_op_id, amount, currency, note, logged_by) VALUES (?, ?, ?, ?, ?)")
        .bind(opId, body.amount, body.currency, body.note ?? null, user.id)
        .run();

      return c.json({ ok: true });
    },
  );

  // ── Capital ─────────────────────────────────────────────────────────

  routes.post("/:opId/capital",
    validate("json", z.object({
      amount: z.number().int().min(1).max(999_999_999),
      currency: z.string().max(10).default("aUEC"),
      note: z.string().max(500).nullable().optional(),
    })),
    async (c) => {
      const user = getAuthUser(c);
      const slug = c.req.param("slug")!;
      const opId = parseInt(c.req.param("opId"), 10);
      const db = c.env.DB;

      const ctx = await getOrgMembership(db, slug, user.id);
      if (!ctx) return c.json({ error: "Not found" }, 404);

      const participant = await db
        .prepare("SELECT id FROM org_op_participants WHERE org_op_id = ? AND user_id = ? AND left_at IS NULL")
        .bind(opId, user.id)
        .first();
      if (!participant) return c.json({ error: "Must be a participant" }, 403);

      const body = c.req.valid("json");
      await db
        .prepare("INSERT INTO org_op_capital (org_op_id, user_id, amount, currency, note) VALUES (?, ?, ?, ?, ?)")
        .bind(opId, user.id, body.amount, body.currency, body.note ?? null)
        .run();

      return c.json({ ok: true });
    },
  );

  // ── Complete op + calculate payouts ─────────────────────────────────

  routes.post("/:opId/complete", async (c) => {
    const user = getAuthUser(c);
    const slug = c.req.param("slug")!;
    const opId = parseInt(c.req.param("opId"), 10);
    const db = c.env.DB;

    const ctx = await getOrgMembership(db, slug, user.id);
    if (!ctx) return c.json({ error: "Not found" }, 404);

    const op = await db
      .prepare("SELECT id, status, created_by, started_at FROM org_ops WHERE id = ? AND org_id = ?")
      .bind(opId, ctx.orgId)
      .first<{ id: number; status: string; created_by: string; started_at: string | null }>();
    if (!op) return c.json({ error: "Not found" }, 404);

    if (!canManageOp(ctx.role, user.id, op.created_by)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    if (op.status !== "active") {
      return c.json({ error: "Can only complete active ops" }, 400);
    }

    const completedAt = new Date().toISOString().replace("T", " ").split(".")[0];

    // Get totals
    const earningsTotal = await db
      .prepare("SELECT COALESCE(SUM(amount), 0) as total FROM org_op_earnings WHERE org_op_id = ?")
      .bind(opId)
      .first<{ total: number }>();

    const capitalTotal = await db
      .prepare("SELECT COALESCE(SUM(amount), 0) as total FROM org_op_capital WHERE org_op_id = ? AND paid = 1")
      .bind(opId)
      .first<{ total: number }>();

    // Get participants
    const { results: participantRows } = await db
      .prepare("SELECT user_id, payout_ratio, joined_at, left_at, logged_off FROM org_op_participants WHERE org_op_id = ?")
      .bind(opId)
      .all();

    const participants = participantRows as unknown as ParticipantInput[];

    const payouts = calculatePayouts(
      participants,
      earningsTotal?.total ?? 0,
      capitalTotal?.total ?? 0,
      op.started_at ?? completedAt,
      completedAt,
      op.created_by,
    );

    // Write payouts + update status atomically
    const stmts = [
      db.prepare("UPDATE org_ops SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?")
        .bind(completedAt, completedAt, opId),
    ];

    for (const payout of payouts) {
      stmts.push(
        db.prepare(
          `INSERT INTO org_op_payouts (org_op_id, user_id, amount, currency)
           VALUES (?, ?, ?, 'aUEC')
           ON CONFLICT(org_op_id, user_id) DO UPDATE SET amount = excluded.amount`,
        ).bind(opId, payout.user_id, payout.amount),
      );
    }

    await db.batch(stmts);

    return c.json({ ok: true, payouts });
  });

  // ── Mark payout paid ────────────────────────────────────────────────

  routes.patch("/:opId/payouts/:userId", async (c) => {
    const user = getAuthUser(c);
    const slug = c.req.param("slug")!;
    const opId = parseInt(c.req.param("opId"), 10);
    const payeeUserId = c.req.param("userId");
    const db = c.env.DB;

    const ctx = await getOrgMembership(db, slug, user.id);
    if (!ctx) return c.json({ error: "Not found" }, 404);

    const op = await db
      .prepare("SELECT created_by FROM org_ops WHERE id = ? AND org_id = ?")
      .bind(opId, ctx.orgId)
      .first<{ created_by: string }>();
    if (!op) return c.json({ error: "Not found" }, 404);

    if (!canManageOp(ctx.role, user.id, op.created_by)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await db
      .prepare("UPDATE org_op_payouts SET paid = 1, paid_at = datetime('now') WHERE org_op_id = ? AND user_id = ?")
      .bind(opId, payeeUserId)
      .run();

    return c.json({ ok: true });
  });

  // ── Join code (public ops) ──────────────────────────────────────────

  routes.post("/:opId/code", async (c) => {
    const user = getAuthUser(c);
    const slug = c.req.param("slug")!;
    const opId = parseInt(c.req.param("opId"), 10);
    const db = c.env.DB;

    const ctx = await getOrgMembership(db, slug, user.id);
    if (!ctx) return c.json({ error: "Not found" }, 404);

    const op = await db
      .prepare("SELECT id, created_by, status FROM org_ops WHERE id = ? AND org_id = ?")
      .bind(opId, ctx.orgId)
      .first<{ id: number; created_by: string; status: string }>();
    if (!op) return c.json({ error: "Not found" }, 404);

    if (!canManageOp(ctx.role, user.id, op.created_by)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    // Generate 4-char alphanumeric code
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I/O/0/1 to avoid confusion
    let code = "";
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 4; i++) {
      code += chars[bytes[i] % chars.length];
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace("T", " ").split(".")[0];

    await db
      .prepare("UPDATE org_ops SET is_public = 1, join_code = ?, join_code_expires_at = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(code, expiresAt, opId)
      .run();

    return c.json({ ok: true, join_code: code, expires_at: expiresAt });
  });

  routes.delete("/:opId/code", async (c) => {
    const user = getAuthUser(c);
    const slug = c.req.param("slug")!;
    const opId = parseInt(c.req.param("opId"), 10);
    const db = c.env.DB;

    const ctx = await getOrgMembership(db, slug, user.id);
    if (!ctx) return c.json({ error: "Not found" }, 404);

    const op = await db
      .prepare("SELECT created_by FROM org_ops WHERE id = ? AND org_id = ?")
      .bind(opId, ctx.orgId)
      .first<{ created_by: string }>();
    if (!op) return c.json({ error: "Not found" }, 404);

    if (!canManageOp(ctx.role, user.id, op.created_by)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await db
      .prepare("UPDATE org_ops SET is_public = 0, join_code = NULL, join_code_expires_at = NULL, updated_at = datetime('now') WHERE id = ?")
      .bind(opId)
      .run();

    return c.json({ ok: true });
  });

  // ── Op types lookup ─────────────────────────────────────────────────

  routes.get("/types", async (c) => {
    const { results } = await c.env.DB.prepare("SELECT id, key, label FROM op_types ORDER BY id").all();
    return c.json({ types: results });
  });

  return routes;
}

// ── Public join routes (mounted at /api/ops) ────────────────────────

export function publicOpsRoutes() {
  const routes = new Hono<HonoEnv>();

  // GET /api/ops/join/:code — op summary for join page
  routes.get("/join/:code", async (c) => {
    const code = c.req.param("code").toUpperCase();
    const db = c.env.DB;

    const op = await db
      .prepare(
        `SELECT o.id, o.name, o.status, o.description, o.join_code_expires_at,
          ot.label as op_type_label,
          org.name as org_name, org.slug as org_slug, org.logo as org_logo,
          (SELECT COUNT(*) FROM org_op_participants p WHERE p.org_op_id = o.id AND p.left_at IS NULL) as participant_count
        FROM org_ops o
        JOIN op_types ot ON ot.id = o.op_type_id
        JOIN organization org ON org.id = o.org_id
        WHERE o.join_code = ? AND o.is_public = 1`,
      )
      .bind(code)
      .first();

    if (!op) return c.json({ error: "Op not found or code expired" }, 404);

    // Check expiry
    const r = op as Record<string, unknown>;
    if (r.join_code_expires_at) {
      const expires = new Date((r.join_code_expires_at as string) + "Z").getTime();
      if (Date.now() > expires) {
        return c.json({ error: "Join code has expired" }, 410);
      }
    }

    return c.json({ op });
  });

  // POST /api/ops/join/:code — join a public op
  routes.post("/join/:code", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const code = c.req.param("code").toUpperCase();
    const db = c.env.DB;

    const op = await db
      .prepare(
        `SELECT o.id, o.org_id, o.status, o.join_code_expires_at
        FROM org_ops o
        WHERE o.join_code = ? AND o.is_public = 1`,
      )
      .bind(code)
      .first<{ id: number; org_id: string; status: string; join_code_expires_at: string | null }>();

    if (!op) return c.json({ error: "Op not found or code expired" }, 404);

    // Check expiry
    if (op.join_code_expires_at) {
      const expires = new Date(op.join_code_expires_at + "Z").getTime();
      if (Date.now() > expires) {
        return c.json({ error: "Join code has expired" }, 410);
      }
    }

    if (op.status !== "planning" && op.status !== "active") {
      return c.json({ error: "This op is no longer accepting participants" }, 400);
    }

    // Add participant (non-members joining via code are NOT added to the org)
    try {
      await db
        .prepare("INSERT INTO org_op_participants (org_op_id, user_id) VALUES (?, ?)")
        .bind(op.id, user.id)
        .run();
    } catch {
      return c.json({ error: "Already joined this op" }, 409);
    }

    // Find org slug for redirect
    const org = await db
      .prepare("SELECT slug FROM organization WHERE id = ?")
      .bind(op.org_id)
      .first<{ slug: string }>();

    return c.json({ ok: true, org_slug: org?.slug, op_id: op.id });
  });

  return routes;
}
