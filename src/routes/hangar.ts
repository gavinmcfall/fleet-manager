import { Hono } from "hono";
import type { HonoEnv } from "../lib/types";
import { getAuthUser } from "../lib/types";
import { getUserHangarItems } from "../db/queries";

/**
 * /api/hangar — the user's complete pledge-item inventory.
 * One row per `user_pledge_items` row, joined to its parent pledge.
 * Public-by-account-only (auth required); covers everything the user
 * owns from RSI: ships, insurance, paints, FPS gear, components,
 * hangar decorations, credits, and uncategorised items.
 */
export function hangarRoutes() {
  const routes = new Hono<HonoEnv>();

  routes.get("/", async (c) => {
    const user = getAuthUser(c);
    const items = await getUserHangarItems(c.env.DB, user.id);

    // Counts by kind — NULL bucketed under 'uncategorised'.
    const counts: Record<string, number> = {};
    for (const item of items) {
      const bucket = item.kind ?? "uncategorised";
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }

    return c.json({
      items,
      counts,
      total: items.length,
    });
  });

  return routes;
}
