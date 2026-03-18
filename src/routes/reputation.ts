import { Hono } from "hono";
import type { HonoEnv } from "../lib/types";

/**
 * /api/users/:userId/reputation — Public reputation summary
 */
export function reputationRoutes() {
  const routes = new Hono<HonoEnv>();

  // GET /api/users/:userId/reputation — reputation summary
  routes.get("/:userId/reputation", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const userId = c.req.param("userId");
    const db = c.env.DB;

    const { results: categories } = await db
      .prepare("SELECT id, key, label FROM rating_categories ORDER BY id")
      .all();

    const { results: scores } = await db
      .prepare(
        `SELECT pr.rating_category_id, pr.median_score, pr.rating_count
         FROM player_reputation pr
         WHERE pr.user_id = ?`,
      )
      .bind(userId)
      .all();

    const totalCount = await db
      .prepare("SELECT COUNT(DISTINCT org_op_id) as ops_rated FROM player_ratings WHERE ratee_user_id = ?")
      .bind(userId)
      .first<{ ops_rated: number }>();

    const reputation = categories.map((cat: Record<string, unknown>) => {
      const score = scores.find(
        (s: Record<string, unknown>) => s.rating_category_id === cat.id,
      ) as Record<string, unknown> | undefined;
      return {
        category: cat.key,
        label: cat.label,
        median_score: score?.median_score ?? 0,
        rating_count: score?.rating_count ?? 0,
      };
    });

    return c.json({
      reputation,
      ops_rated: totalCount?.ops_rated ?? 0,
    });
  });

  return routes;
}
