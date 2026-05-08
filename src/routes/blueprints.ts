import { Hono } from "hono";
import { z } from "zod";
import { getAuthUser, type HonoEnv } from "../lib/types";
import { validate } from "../lib/validation";

/**
 * /api/blueprints/* — User-saved blueprints (owned / wishlist / crafting tracker)
 *
 * Identifier: blueprint_uuid (channel-stable across LIVE and PTU). The legacy
 * crafting_blueprint_id column is still populated for backwards compatibility
 * with the existing quality-sim save flow, but new flows key on uuid.
 */
export function blueprintRoutes() {
  const routes = new Hono<HonoEnv>();

  // ── GET / — list user's saved blueprints (owned + wishlist) ──────
  // Resolves blueprint metadata by uuid against BOTH the LIVE and PTU
  // tables so PTU-only blueprints (Banu Tachyoncannon, Wikelo variants)
  // still render with name/tag/type when the user marks them owned. We
  // also surface a derived `has_quality_config` flag so the UI can show
  // a "saved sim" indicator without parsing the full config blob client
  // side.
  routes.get("/", async (c) => {
    const db = c.env.DB;
    const userId = getAuthUser(c).id;

    const rows = await db
      .prepare(
        `SELECT ub.id, ub.crafting_blueprint_id, ub.blueprint_uuid,
                ub.is_owned, ub.is_wishlist,
                ub.nickname, ub.crafted_quantity,
                ub.quality_config_json, ub.source, ub.updated_at,
                COALESCE(lcb.name, pcb.name) AS blueprint_name,
                COALESCE(lcb.tag, pcb.tag) AS tag,
                COALESCE(lcb.type, pcb.type) AS type,
                COALESCE(lcb.sub_type, pcb.sub_type) AS sub_type,
                COALESCE(lcb.craft_time_seconds, pcb.craft_time_seconds) AS craft_time_seconds,
                COALESCE(lcb.id, ub.crafting_blueprint_id) AS resolved_blueprint_id,
                CASE WHEN lcb.id IS NULL AND pcb.id IS NOT NULL THEN 1 ELSE 0 END AS is_ptu_only
         FROM user_blueprints ub
         LEFT JOIN crafting_blueprints lcb ON lcb.uuid = ub.blueprint_uuid
         LEFT JOIN ptu_crafting_blueprints pcb ON pcb.uuid = ub.blueprint_uuid
         WHERE ub.user_id = ?
         ORDER BY ub.updated_at DESC`,
      )
      .bind(userId)
      .all();

    return c.json({
      items: rows.results.map((r) => ({
        ...r,
        is_owned: r.is_owned === 1,
        is_wishlist: r.is_wishlist === 1,
        is_ptu_only: r.is_ptu_only === 1,
        has_quality_config: !!r.quality_config_json,
        // crafting_blueprint_id may be null (PTU-only BP). Use the
        // resolved id for navigation links to the LIVE detail page.
        crafting_blueprint_id: r.resolved_blueprint_id,
        quality_config: r.quality_config_json
          ? JSON.parse(r.quality_config_json as string)
          : null,
        quality_config_json: undefined,
        resolved_blueprint_id: undefined,
      })),
    });
  });

  // ── PUT /state — toggle owned/wishlist by blueprint uuid ─────────
  // Sets absolute state. If both flags become false, the row is deleted
  // (no point keeping an empty marker). Resolves crafting_blueprint_id
  // for backwards compatibility with the quality-sim save flow.
  routes.put(
    "/state",
    validate(
      "json",
      z.object({
        blueprintUuid: z.string().uuid(),
        owned: z.boolean().optional(),
        wishlist: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const db = c.env.DB;
      const userId = getAuthUser(c).id;
      const { blueprintUuid, owned, wishlist } = c.req.valid("json");

      // Read current state so we can compute the new state when only
      // one flag is provided.
      const existing = await db
        .prepare(
          `SELECT id, is_owned, is_wishlist FROM user_blueprints
           WHERE user_id = ? AND blueprint_uuid = ?`,
        )
        .bind(userId, blueprintUuid)
        .first<{ id: number; is_owned: number; is_wishlist: number }>();

      const nextOwned = owned ?? (existing ? existing.is_owned === 1 : false);
      const nextWishlist =
        wishlist ?? (existing ? existing.is_wishlist === 1 : false);

      // Both flags off → delete the row. But keep rows that have
      // crafted_quantity > 0 or a saved quality_config (the user has
      // attached crafting work to this BP and we shouldn't drop it).
      if (!nextOwned && !nextWishlist) {
        const detail = existing
          ? await db
              .prepare(
                `SELECT crafted_quantity, quality_config_json
                 FROM user_blueprints WHERE id = ?`,
              )
              .bind(existing.id)
              .first<{
                crafted_quantity: number | null;
                quality_config_json: string | null;
              }>()
          : null;
        const hasWork =
          (detail?.crafted_quantity ?? 0) > 0 ||
          !!detail?.quality_config_json;
        if (!hasWork && existing) {
          await db
            .prepare("DELETE FROM user_blueprints WHERE id = ?")
            .bind(existing.id)
            .run();
          return c.json({ ok: true, owned: false, wishlist: false });
        }
        // Otherwise just clear the flags — keep the row.
        await db
          .prepare(
            `UPDATE user_blueprints
             SET is_owned = 0, is_wishlist = 0, updated_at = datetime('now')
             WHERE user_id = ? AND blueprint_uuid = ?`,
          )
          .bind(userId, blueprintUuid)
          .run();
        return c.json({ ok: true, owned: false, wishlist: false });
      }

      // Resolve the legacy FK column from the active LIVE blueprint
      // table (PTU-only blueprints leave it NULL — uuid is the source
      // of truth either way).
      const bpRow = await db
        .prepare("SELECT id FROM crafting_blueprints WHERE uuid = ? LIMIT 1")
        .bind(blueprintUuid)
        .first<{ id: number }>();
      const legacyId = bpRow?.id ?? null;

      await db
        .prepare(
          `INSERT INTO user_blueprints
             (user_id, crafting_blueprint_id, blueprint_uuid,
              is_owned, is_wishlist, source, updated_at)
           VALUES (?, ?, ?, ?, ?, 'manual', datetime('now'))
           ON CONFLICT(user_id, blueprint_uuid) DO UPDATE SET
             is_owned = excluded.is_owned,
             is_wishlist = excluded.is_wishlist,
             crafting_blueprint_id =
               COALESCE(user_blueprints.crafting_blueprint_id, excluded.crafting_blueprint_id),
             updated_at = datetime('now')`,
        )
        .bind(
          userId,
          legacyId,
          blueprintUuid,
          nextOwned ? 1 : 0,
          nextWishlist ? 1 : 0,
        )
        .run();

      return c.json({ ok: true, owned: nextOwned, wishlist: nextWishlist });
    },
  );

  // ── POST / — save quality-sim config for a blueprint ────────────
  // Legacy route used by the quality simulator. Implicitly marks the
  // blueprint as owned because saving a sim config means the user is
  // working with this blueprint.
  routes.post(
    "/",
    validate(
      "json",
      z.object({
        craftingBlueprintId: z.number().int().positive(),
        nickname: z.string().max(100).nullable().optional(),
        qualityConfig: z
          .record(z.string(), z.number().int().min(0).max(1000))
          .nullable()
          .optional(),
      }),
    ),
    async (c) => {
      const db = c.env.DB;
      const userId = getAuthUser(c).id;
      const { craftingBlueprintId, nickname, qualityConfig } =
        c.req.valid("json");

      const configJson = qualityConfig ? JSON.stringify(qualityConfig) : null;

      // Look up the uuid for the new uniqueness key.
      const bp = await db
        .prepare("SELECT uuid FROM crafting_blueprints WHERE id = ?")
        .bind(craftingBlueprintId)
        .first<{ uuid: string }>();

      await db
        .prepare(
          `INSERT INTO user_blueprints
             (user_id, crafting_blueprint_id, blueprint_uuid,
              nickname, quality_config_json, is_owned, source, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, 'manual', datetime('now'))
           ON CONFLICT(user_id, blueprint_uuid) DO UPDATE SET
             nickname = COALESCE(excluded.nickname, user_blueprints.nickname),
             quality_config_json =
               COALESCE(excluded.quality_config_json, user_blueprints.quality_config_json),
             is_owned = 1,
             updated_at = datetime('now')`,
        )
        .bind(
          userId,
          craftingBlueprintId,
          bp?.uuid ?? null,
          nickname ?? null,
          configJson,
        )
        .run();

      return c.json({ ok: true });
    },
  );

  // ── PATCH /:id — update nickname or crafted quantity ────────────
  routes.patch(
    "/:id",
    validate(
      "json",
      z.object({
        nickname: z.string().max(100).nullable().optional(),
        craftedQuantity: z.number().int().min(0).optional(),
        qualityConfig: z
          .record(z.string(), z.number().int().min(0).max(1000))
          .nullable()
          .optional(),
      }),
    ),
    async (c) => {
      const db = c.env.DB;
      const userId = getAuthUser(c).id;
      const id = parseInt(c.req.param("id"));
      const body = c.req.valid("json");

      const row = await db
        .prepare("SELECT id FROM user_blueprints WHERE id = ? AND user_id = ?")
        .bind(id, userId)
        .first();
      if (!row) return c.json({ error: "Not found" }, 404);

      const sets: string[] = [];
      const vals: unknown[] = [];

      if (body.nickname !== undefined) {
        sets.push("nickname = ?");
        vals.push(body.nickname);
      }
      if (body.craftedQuantity !== undefined) {
        sets.push("crafted_quantity = ?");
        vals.push(body.craftedQuantity);
      }
      if (body.qualityConfig !== undefined) {
        sets.push("quality_config_json = ?");
        vals.push(
          body.qualityConfig ? JSON.stringify(body.qualityConfig) : null,
        );
      }

      if (sets.length === 0) return c.json({ ok: true });

      sets.push("updated_at = datetime('now')");
      vals.push(id, userId);

      await db
        .prepare(
          `UPDATE user_blueprints SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
        )
        .bind(...vals)
        .run();

      return c.json({ ok: true });
    },
  );

  // ── DELETE /:id — remove a saved blueprint ──────────────────────
  routes.delete("/:id", async (c) => {
    const db = c.env.DB;
    const userId = getAuthUser(c).id;
    const id = parseInt(c.req.param("id"));

    await db
      .prepare("DELETE FROM user_blueprints WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .run();

    return c.json({ ok: true });
  });

  return routes;
}
