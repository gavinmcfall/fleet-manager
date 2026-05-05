import { Hono, type Context, type Next } from "hono";
import { z } from "zod";
import { getAuthUser, type HonoEnv } from "../lib/types";
import { SET_SLUG_REWARD_TEXTS } from "../lib/loot-sets";
import {
  getLootItems,
  getLootByUuid,
  getLootLocationSummary,
  getLootLocationDetail,
  getUserLootCollection,
  addToLootCollection,
  setLootCollectionQuantity,
  removeFromLootCollection,
  getUserLootWishlist,
  addToLootWishlist,
  setLootWishlistQuantity,
  removeFromLootWishlist,
  getLootSets,
  getLootSetBySlug,
} from "../db/queries";
import { validate } from "../lib/validation";
import { cachedJson, cacheSlug } from "../lib/cache";
import { getActiveChannel, isPTUChannel } from "../lib/ptu";

// Auth middleware — reused for collection and wishlist sub-paths
async function requireUser(c: Context<HonoEnv>, next: Next): Promise<Response | void> {
  if (!c.get("user")) return c.json({ error: "Unauthorized" }, 401);
  return next();
}

/**
 * /api/loot — Loot/item finder (public browsing, auth-gated collection tracking)
 */
export function lootRoutes() {
  const app = new Hono<HonoEnv>();

  // GET /api/loot — all items (public), no JSON blobs
  app.get("/", async (c) => {
    const channel = getActiveChannel(c);
    const isPTU = isPTUChannel(channel);
    return cachedJson(c, `loot:items:${channel.toLowerCase()}`, () =>
      getLootItems(c.env.DB, isPTU),
    );
  });

  // Auth middleware for collection and wishlist
  app.use("/collection", requireUser);
  app.use("/collection/*", requireUser);
  app.use("/wishlist", requireUser);
  app.use("/wishlist/*", requireUser);

  // GET /api/loot/collection — current user's collected loot_map_ids
  app.get("/collection", async (c) => {
    const user = getAuthUser(c);
    const ids = await getUserLootCollection(c.env.DB, user.id);
    return c.json(ids);
  });

  // POST /api/loot/collection/:uuid — mark item collected
  app.post("/collection/:uuid", async (c) => {
    const user = getAuthUser(c);
    const uuid = c.req.param("uuid");

    const row = await c.env.DB
      .prepare("SELECT id FROM loot_map WHERE uuid = ? LIMIT 1")
      .bind(uuid)
      .first<{ id: number }>();
    if (!row) return c.json({ error: "Item not found" }, 404);

    await addToLootCollection(c.env.DB, user.id, row.id);
    return c.json({ ok: true });
  });

  // PATCH /api/loot/collection/:uuid — set quantity; quantity=0 removes
  app.patch("/collection/:uuid",
    validate("json", z.object({ quantity: z.number().int().min(0, "quantity must be >= 0") })),
    async (c) => {
    const user = getAuthUser(c);
    const uuid = c.req.param("uuid");
    const { quantity } = c.req.valid("json");

    const row = await c.env.DB
      .prepare("SELECT id FROM loot_map WHERE uuid = ? LIMIT 1")
      .bind(uuid)
      .first<{ id: number }>();
    if (!row) return c.json({ error: "Item not found" }, 404);

    if (quantity === 0) {
      await removeFromLootCollection(c.env.DB, user.id, row.id);
    } else {
      await setLootCollectionQuantity(c.env.DB, user.id, row.id, quantity);
    }
    return c.json({ ok: true });
  });

  // DELETE /api/loot/collection/:uuid — unmark item collected
  app.delete("/collection/:uuid", async (c) => {
    const user = getAuthUser(c);
    const uuid = c.req.param("uuid");

    const row = await c.env.DB
      .prepare("SELECT id FROM loot_map WHERE uuid = ? LIMIT 1")
      .bind(uuid)
      .first<{ id: number }>();
    if (!row) return c.json({ error: "Item not found" }, 404);

    await removeFromLootCollection(c.env.DB, user.id, row.id);
    return c.json({ ok: true });
  });

  // GET /api/loot/wishlist — current user's wishlisted items with location JSON
  app.get("/wishlist", async (c) => {
    const user = getAuthUser(c);
    const channel = getActiveChannel(c);
    const isPTU = isPTUChannel(channel);
    const items = await getUserLootWishlist(c.env.DB, user.id, isPTU);
    return c.json(items);
  });

  // POST /api/loot/wishlist/:uuid — add item to wishlist
  app.post("/wishlist/:uuid", async (c) => {
    const user = getAuthUser(c);
    const uuid = c.req.param("uuid");

    const row = await c.env.DB
      .prepare("SELECT id FROM loot_map WHERE uuid = ? LIMIT 1")
      .bind(uuid)
      .first<{ id: number }>();
    if (!row) return c.json({ error: "Item not found" }, 404);

    await addToLootWishlist(c.env.DB, user.id, row.id);
    return c.json({ ok: true });
  });

  // PATCH /api/loot/wishlist/:uuid — set quantity; quantity=0 removes
  app.patch("/wishlist/:uuid",
    validate("json", z.object({ quantity: z.number().int().min(0, "quantity must be >= 0") })),
    async (c) => {
    const user = getAuthUser(c);
    const uuid = c.req.param("uuid");
    const { quantity } = c.req.valid("json");

    const row = await c.env.DB
      .prepare("SELECT id FROM loot_map WHERE uuid = ? LIMIT 1")
      .bind(uuid)
      .first<{ id: number }>();
    if (!row) return c.json({ error: "Item not found" }, 404);

    if (quantity === 0) {
      await removeFromLootWishlist(c.env.DB, user.id, row.id);
    } else {
      await setLootWishlistQuantity(c.env.DB, user.id, row.id, quantity);
    }
    return c.json({ ok: true });
  });

  // DELETE /api/loot/wishlist/:uuid — remove item from wishlist
  app.delete("/wishlist/:uuid", async (c) => {
    const user = getAuthUser(c);
    const uuid = c.req.param("uuid");

    const row = await c.env.DB
      .prepare("SELECT id FROM loot_map WHERE uuid = ? LIMIT 1")
      .bind(uuid)
      .first<{ id: number }>();
    if (!row) return c.json({ error: "Item not found" }, 404);

    await removeFromLootWishlist(c.env.DB, user.id, row.id);
    return c.json({ ok: true });
  });

  // GET /api/loot/locations — lightweight summary for POI directory (public)
  app.get("/locations", async (c) => {
    const channel = getActiveChannel(c);
    const isPTU = isPTUChannel(channel);
    return cachedJson(c, `loot:loc-summary:${channel.toLowerCase()}`, () =>
      getLootLocationSummary(c.env.DB, isPTU),
    );
  });

  // GET /api/loot/locations/:type/:slug — items for a single location (public)
  // Accepts both singular (container) and plural (containers) for convenience
  app.get("/locations/:type/:slug", async (c) => {
    let type = c.req.param("type") as string;
    // Normalize plural to singular
    if (type === "containers") type = "container";
    else if (type === "shops") type = "shop";
    else if (type === "npcs") type = "npc";
    else if (type === "contracts") type = "contract";
    if (!["container", "shop", "npc", "contract"].includes(type)) {
      return c.json({ error: "Invalid location type" }, 400);
    }
    const slug = decodeURIComponent(c.req.param("slug"));
    const channel = getActiveChannel(c);
    const isPTU = isPTUChannel(channel);
    return cachedJson(
      c,
      `loot:loc-detail:${type}:${cacheSlug(slug)}:${channel.toLowerCase()}`,
      () =>
        getLootLocationDetail(
          c.env.DB,
          type as "container" | "shop" | "npc" | "contract",
          slug,
          isPTU,
        ),
    );
  });

  // GET /api/loot/sets — list all armor sets (public)
  app.get("/sets", async (c) => {
    const channel = getActiveChannel(c);
    const isPTU = isPTUChannel(channel);
    return cachedJson(c, `loot:sets:${channel.toLowerCase()}`, () =>
      getLootSets(c.env.DB, isPTU),
    );
  });

  // GET /api/loot/sets/:setSlug — full set detail with pieces, stats, locations (public)
  app.get("/sets/:setSlug", async (c) => {
    const setSlug = c.req.param("setSlug");
    if (setSlug.length > 200) return c.json({ error: "Not found" }, 404);
    const channel = getActiveChannel(c);
    const isPTU = isPTUChannel(channel);
    return cachedJson(
      c,
      `loot:set-detail:${cacheSlug(setSlug)}:${channel.toLowerCase()}`,
      async () => {
        const set = await getLootSetBySlug(c.env.DB, setSlug, isPTU);
        if (!set) return null;

        const rewardTexts = SET_SLUG_REWARD_TEXTS[setSlug];
        let awardingContracts: { id: number; title: string; giver_slug: string }[] = [];
        if (rewardTexts && rewardTexts.length > 0) {
          const placeholders = rewardTexts.map(() => "?").join(",");
          const result = await c.env.DB
            .prepare(`SELECT id, title, giver_slug FROM contracts WHERE reward_text IN (${placeholders})`)
            .bind(...rewardTexts)
            .all<{ id: number; title: string; giver_slug: string }>();
          awardingContracts = result.results ?? [];
        }

        return { ...set, awardingContracts };
      },
    );
  });

  // GET /api/loot/:uuid — full detail + location data (public)
  // Must be last to avoid matching /collection and /wishlist
  app.get("/:uuid", async (c) => {
    const uuid = c.req.param("uuid");
    if (uuid.length > 50) return c.json({ error: "Not found" }, 404);
    const channel = getActiveChannel(c);
    const isPTU = isPTUChannel(channel);
    return cachedJson(
      c,
      `loot:detail:${cacheSlug(uuid)}:${channel.toLowerCase()}`,
      () => getLootByUuid(c.env.DB, uuid, isPTU),
    );
  });

  return app;
}
