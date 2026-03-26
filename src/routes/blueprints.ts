import { Hono } from "hono";
import { z } from "zod";
import { getAuthUser, type HonoEnv } from "../lib/types";
import { validate } from "../lib/validation";

/**
 * /api/blueprints/* — User saved blueprints (crafting tracker)
 */
export function blueprintRoutes() {
  const routes = new Hono<HonoEnv>();

  // ── GET / — list user's saved blueprints ────────────────────────
  routes.get("/", async (c) => {
    const db = c.env.DB;
    const userId = getAuthUser(c).id;

    const rows = await db
      .prepare(
        `SELECT ub.id, ub.crafting_blueprint_id, ub.nickname, ub.crafted_quantity,
                ub.quality_config_json, ub.source, ub.updated_at,
                cb.name as blueprint_name, cb.tag, cb.type, cb.sub_type,
                cb.craft_time_seconds
         FROM user_blueprints ub
         JOIN crafting_blueprints cb ON cb.id = ub.crafting_blueprint_id
         WHERE ub.user_id = ?
         ORDER BY ub.updated_at DESC`,
      )
      .bind(userId)
      .all();

    return c.json({
      items: rows.results.map((r) => ({
        ...r,
        quality_config: r.quality_config_json
          ? JSON.parse(r.quality_config_json as string)
          : null,
        quality_config_json: undefined,
      })),
    });
  });

  // ── POST / — save a blueprint with quality config ───────────────
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

      await db
        .prepare(
          `INSERT INTO user_blueprints (user_id, crafting_blueprint_id, nickname, quality_config_json, source, updated_at)
           VALUES (?, ?, ?, ?, 'manual', datetime('now'))
           ON CONFLICT(user_id, crafting_blueprint_id) DO UPDATE SET
             nickname = COALESCE(excluded.nickname, user_blueprints.nickname),
             quality_config_json = COALESCE(excluded.quality_config_json, user_blueprints.quality_config_json),
             updated_at = datetime('now')`,
        )
        .bind(userId, craftingBlueprintId, nickname ?? null, configJson)
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

      // Verify ownership
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
