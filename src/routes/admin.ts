import { Hono } from "hono";
import { z } from "zod";
import type { HonoEnv } from "../lib/types";
import { uploadToCFImages } from "../lib/cfImages";
import { getVehiclesNeedingCFUpload, setVehicleCFImagesID } from "../db/queries";
import { concurrentMap } from "../lib/utils";
import { validate } from "../lib/validation";
import { VEHICLE_VERSION_JOIN } from "../lib/constants";
import { purgeByPrefix } from "../lib/cache";

/**
 * /api/admin/* — Admin-only management endpoints (super_admin required)
 */
export function adminRoutes() {
  const routes = new Hono<HonoEnv>();

  /**
   * POST /api/admin/images/bulk-upload?limit=50&offset=0
   *
   * Uploads ship images to Cloudflare Images in batches.
   * Idempotent — skips vehicles that already have a cf_images_id.
   * Returns { processed, succeeded, failed, errors: [{ slug, error }] }
   */
  routes.post("/images/bulk-upload",
    validate("query", z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    })),
    async (c) => {
    const token = c.env.CLOUDFLARE_IMAGES_TOKEN;
    const accountHash = c.env.CF_ACCOUNT_HASH;
    const accountId = c.env.CF_ACCOUNT_ID;

    if (!token || !accountHash || !accountId) {
      return c.json(
        { error: "CLOUDFLARE_IMAGES_TOKEN, CF_ACCOUNT_HASH, and CF_ACCOUNT_ID must be set" },
        500,
      );
    }

    const { limit, offset } = c.req.valid("query");

    const vehicles = await getVehiclesNeedingCFUpload(c.env.DB, limit, offset);

    const errors: { slug: string; error: string }[] = [];

    const results = await concurrentMap(vehicles, 5, async (v) => {
      try {
        const cfImagesId = await uploadToCFImages(accountId, token, v.best_image_url, {
          slug: v.slug,
          vehicle_id: String(v.vehicle_id),
        });
        await setVehicleCFImagesID(c.env.DB, v.vehicle_id, cfImagesId, accountHash);
        return true;
      } catch (err) {
        errors.push({ slug: v.slug, error: String(err) });
        console.error(`[admin/images] CF upload failed for ${v.slug}:`, err);
        return false;
      }
    });

    const succeeded = results.filter(Boolean).length;

    return c.json({
      processed: vehicles.length,
      succeeded,
      failed: results.length - succeeded,
      errors,
    });
  });

  /**
   * POST /api/admin/images/upload
   * Body: { slug: string, imageUrl: string }
   *
   * Manually upload a specific ship image by slug and source URL.
   * Useful for ships with broken/missing images (e.g. Valkyrie Liberator Edition).
   * Returns { slug, cf_images_id, image_url }
   */
  routes.post("/images/upload",
    validate("json", z.object({
      slug: z.string().min(1, "slug is required").max(100),
      imageUrl: z.string().url("imageUrl must be a valid URL"),
    })),
    async (c) => {
    const token = c.env.CLOUDFLARE_IMAGES_TOKEN;
    const accountHash = c.env.CF_ACCOUNT_HASH;
    const accountId = c.env.CF_ACCOUNT_ID;

    if (!token || !accountHash || !accountId) {
      return c.json(
        { error: "CLOUDFLARE_IMAGES_TOKEN, CF_ACCOUNT_HASH, and CF_ACCOUNT_ID must be set" },
        500,
      );
    }

    const { slug, imageUrl } = c.req.valid("json");

    const vehicleRow = await c.env.DB
      .prepare(`SELECT v.id FROM vehicles v ${VEHICLE_VERSION_JOIN} WHERE v.slug = ?`)
      .bind(slug)
      .first<{ id: number }>();

    if (!vehicleRow) {
      return c.json({ error: `Vehicle not found: ${slug}` }, 404);
    }

    // Ensure vehicle_images row exists
    await c.env.DB
      .prepare(
        `INSERT OR IGNORE INTO vehicle_images (vehicle_id, updated_at)
        VALUES (?, datetime('now'))`,
      )
      .bind(vehicleRow.id)
      .run();

    const cfImagesId = await uploadToCFImages(accountId, token, imageUrl, {
      slug,
      vehicle_id: String(vehicleRow.id),
    });

    await setVehicleCFImagesID(c.env.DB, vehicleRow.id, cfImagesId, accountHash);

    const deliveryUrl = `https://imagedelivery.net/${accountHash}/${cfImagesId}/medium`;

    return c.json({
      slug,
      cf_images_id: cfImagesId,
      image_url: deliveryUrl,
    });
  });

  /**
   * PUT /api/admin/versions/default
   *
   * Sets which game version is the public default.
   * Body: { code: string }
   */
  routes.put("/versions/default",
    validate("json", z.object({
      code: z.string().min(1, "code is required").max(100),
    })),
    async (c) => {
    const { code } = c.req.valid("json");

    // Verify version exists
    const version = await c.env.DB
      .prepare("SELECT id, code, channel FROM game_versions WHERE code = ?")
      .bind(code)
      .first<{ id: number; code: string; channel: string }>();

    if (!version) {
      return c.json({ error: `Game version not found: ${code}` }, 404);
    }

    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE game_versions SET is_default = 0 WHERE is_default = 1"),
      c.env.DB.prepare("UPDATE game_versions SET is_default = 1 WHERE code = ?").bind(code),
    ]);

    // Purge all cached data — version change invalidates everything
    const kv = c.env.SC_BRIDGE_CACHE;
    const purgeResult = await purgeByPrefix(kv);

    return c.json({ code: version.code, channel: version.channel, is_default: 1, cache_purged: purgeResult.deleted });
  });

  /**
   * POST /api/admin/invites
   *
   * Generates a single-use invite token and returns the signup URL.
   * Returns { token, url }
   */
  routes.post("/invites", async (c) => {
    const token = crypto.randomUUID();
    const baseUrl = c.env.BETTER_AUTH_URL;
    await c.env.DB
      .prepare("INSERT INTO invite_tokens (token) VALUES (?)")
      .bind(token).run();
    return c.json({ token, url: `${baseUrl}/register?invite=${token}` });
  });

  /**
   * GET /api/admin/invites
   *
   * Lists all invite tokens ordered by creation date descending.
   * Returns [{ token, created_at, used_at }]
   */
  routes.get("/invites", async (c) => {
    const rows = await c.env.DB
      .prepare("SELECT token, created_at, used_at FROM invite_tokens ORDER BY created_at DESC")
      .all<{ token: string; created_at: string; used_at: string | null }>();
    return c.json(rows.results ?? []);
  });

  /**
   * POST /api/admin/cache/purge
   *
   * Purge KV cache. Optional body: { prefix: string } to purge by prefix.
   * Without prefix, purges all cached keys.
   * Returns { deleted: number }
   */
  routes.post("/cache/purge", async (c) => {
    let prefix: string | undefined;
    try {
      const body = await c.req.json();
      if (body?.prefix && typeof body.prefix === "string") {
        prefix = body.prefix.slice(0, 200);
      }
    } catch {
      // Empty body is fine — purge all
    }
    const kv = c.env.SC_BRIDGE_CACHE;
    const result = await purgeByPrefix(kv, prefix);
    return c.json(result);
  });

  /**
   * PUT /api/admin/localization/global-ini
   *
   * Upload base global.ini for a game version. Stored in KV for the
   * localization builder download endpoint.
   * Body: raw text/plain content of global.ini
   * Query: ?version_code=4.6.0-live.11319298
   */
  routes.put("/localization/global-ini",
    validate("query", z.object({
      version_code: z.string().min(1).max(100),
    })),
    async (c) => {
    const { version_code } = c.req.valid("query");
    const kv = c.env.SC_BRIDGE_CACHE;

    // Verify the version exists
    const ver = await c.env.DB
      .prepare("SELECT id FROM game_versions WHERE code = ?")
      .bind(version_code)
      .first<{ id: number }>();
    if (!ver) {
      return c.json({ error: `Game version '${version_code}' not found` }, 404);
    }

    const body = await c.req.text();
    if (!body || body.length < 1000) {
      return c.json({ error: "Body too small to be a valid global.ini" }, 400);
    }

    const key = `localization:global-ini:${version_code}`;
    await kv.put(key, body);

    const lines = body.split("\n").length;
    const sizeKB = Math.round(body.length / 1024);

    return c.json({
      ok: true,
      message: `Stored global.ini for ${version_code}`,
      lines,
      sizeKB,
    });
  });

  // ── Rating audit (super_admin) ──────────────────────────────────────

  // GET /api/admin/ratings/user/:userId — all ratings for a user (not anonymized)
  routes.get("/ratings/user/:userId", async (c) => {
    const userId = c.req.param("userId");
    const db = c.env.DB;

    const { results: ratings } = await db
      .prepare(
        `SELECT pr.id, pr.rater_user_id, pr.ratee_user_id, pr.org_op_id,
          pr.score, pr.ip_address, pr.created_at,
          rc.key as category, rc.label as category_label,
          rater.name as rater_name, ratee.name as ratee_name,
          o.name as op_name
        FROM player_ratings pr
        JOIN rating_categories rc ON rc.id = pr.rating_category_id
        JOIN user rater ON rater.id = pr.rater_user_id
        JOIN user ratee ON ratee.id = pr.ratee_user_id
        LEFT JOIN org_ops o ON o.id = pr.org_op_id
        WHERE pr.ratee_user_id = ?
        ORDER BY pr.created_at DESC`,
      )
      .bind(userId)
      .all();

    const { results: reviews } = await db
      .prepare(
        `SELECT prv.id, prv.rater_user_id, prv.ratee_user_id, prv.org_op_id,
          prv.comment, prv.ip_address, prv.created_at,
          rater.name as rater_name
        FROM player_reviews prv
        JOIN user rater ON rater.id = prv.rater_user_id
        WHERE prv.ratee_user_id = ?
        ORDER BY prv.created_at DESC`,
      )
      .bind(userId)
      .all();

    return c.json({ ratings, reviews });
  });

  // GET /api/admin/ratings/audit — audit log
  routes.get("/ratings/audit", async (c) => {
    const db = c.env.DB;
    const page = parseInt(c.req.query("page") || "1", 10) || 1;
    const perPage = 50;
    const offset = (page - 1) * perPage;

    const { results } = await db
      .prepare(
        `SELECT ral.*, u.name as actor_name
        FROM rating_audit_log ral
        JOIN user u ON u.id = ral.actor_user_id
        ORDER BY ral.created_at DESC
        LIMIT ? OFFSET ?`,
      )
      .bind(perPage, offset)
      .all();

    return c.json({ audit_log: results, page });
  });

  // DELETE /api/admin/ratings/:ratingId — remove abusive rating
  routes.delete("/ratings/:ratingId", async (c) => {
    const ratingId = parseInt(c.req.param("ratingId"), 10);
    const db = c.env.DB;
    const user = c.get("user");
    const ip = c.req.header("CF-Connecting-IP") ?? null;

    const rating = await db
      .prepare("SELECT id, ratee_user_id, rating_category_id FROM player_ratings WHERE id = ?")
      .bind(ratingId)
      .first<{ id: number; ratee_user_id: string; rating_category_id: number }>();
    if (!rating) return c.json({ error: "Rating not found" }, 404);

    await db.batch([
      db.prepare("DELETE FROM player_ratings WHERE id = ?").bind(ratingId),
      db.prepare(
        "INSERT INTO rating_audit_log (action, actor_user_id, target_rating_id, detail, ip_address) VALUES ('remove', ?, ?, 'Admin removed rating', ?)",
      ).bind(user!.id, ratingId, ip),
    ]);

    // Recalculate median for affected category
    const countResult = await db
      .prepare("SELECT COUNT(*) as cnt FROM player_ratings WHERE ratee_user_id = ? AND rating_category_id = ?")
      .bind(rating.ratee_user_id, rating.rating_category_id)
      .first<{ cnt: number }>();
    const count = countResult?.cnt ?? 0;

    if (count === 0) {
      await db
        .prepare("DELETE FROM player_reputation WHERE user_id = ? AND rating_category_id = ?")
        .bind(rating.ratee_user_id, rating.rating_category_id)
        .run();
    } else {
      const offset = Math.floor(count / 2);
      const medianResult = await db
        .prepare("SELECT score FROM player_ratings WHERE ratee_user_id = ? AND rating_category_id = ? ORDER BY score LIMIT 1 OFFSET ?")
        .bind(rating.ratee_user_id, rating.rating_category_id, offset)
        .first<{ score: number }>();

      await db
        .prepare(
          `INSERT INTO player_reputation (user_id, rating_category_id, median_score, rating_count, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(user_id, rating_category_id) DO UPDATE SET
             median_score = excluded.median_score,
             rating_count = excluded.rating_count,
             updated_at = excluded.updated_at`,
        )
        .bind(rating.ratee_user_id, rating.rating_category_id, medianResult?.score ?? 0, count)
        .run();
    }

    return c.json({ ok: true });
  });

  // ── PTU data management ────────────────────────────────────────────

  /**
   * DELETE /api/admin/versions/ptu
   *
   * Purge all game data for a PTU/EPTU channel. The game_versions row is kept
   * alive but with build_number set to NULL, so the EXISTS check in
   * getGameVersions naturally hides it from the dropdown until new data arrives.
   *
   * Body: { channel?: "PTU" | "EPTU" } (defaults to "PTU")
   */
  routes.delete("/versions/ptu",
    validate("json", z.object({
      channel: z.enum(["PTU", "EPTU"]).default("PTU"),
    }).default({ channel: "PTU" })),
    async (c) => {
    const { channel } = c.req.valid("json");
    const db = c.env.DB;

    const version = await db
      .prepare("SELECT id FROM game_versions WHERE channel = ?")
      .bind(channel)
      .first<{ id: number }>();

    if (!version) {
      return c.json({ error: `No ${channel} version row found` }, 404);
    }

    const versionId = version.id;

    // Tables with game_version_id FK in FK-safe deletion order (children before parents).
    // Topologically sorted so no DELETE violates a FK constraint.
    const versionedTables = [
      // Vehicle children → vehicles → manufacturers
      "vehicle_weapon_racks", "vehicle_suit_lockers", "vehicle_ports",
      "salvageable_ships", "vehicle_roles", "vehicle_careers",
      // Loot children → loot_map → FPS/vehicle tables
      "loot_item_locations", "loot_map", "vehicle_components",
      // Shop children → shops → star_map_locations
      "shop_locations", "shop_inventory",
      // Mission children → missions → mission_givers → star_map_locations
      "missions", "mission_givers", "star_map_locations", "star_systems",
      "ship_missiles",
      // Reputation children → reputation_scopes → factions
      "reputation_perks", "reputation_standings",
      "faction_reputation_scopes", "reputation_scopes", "reputation_reward_tiers",
      // NPC children
      "npc_loadout_items", "npc_loadouts",
      // Mining (no inter-table FKs among versioned tables)
      "rock_compositions", "mining_quality_distributions", "mining_modules",
      "mining_locations", "mining_lasers", "mining_gadgets",
      "mining_clustering_presets", "mineable_elements",
      // Mission lookups
      "mission_types", "mission_organizations",
      // FPS tables → manufacturers
      "fps_weapons", "fps_utilities", "fps_melee", "fps_helmets",
      "fps_clothing", "fps_attachments", "fps_armour", "fps_ammo",
      "consumables", "props",
      // Shops (parent)
      "shops",
      // Root parents (most-referenced, delete last)
      "vehicles", "manufacturers",
      // Law system
      "jurisdiction_infraction_overrides", "law_jurisdictions", "law_infractions",
      // Remaining leaf tables
      "harvestables", "fps_carryables", "fps_ammo_types", "consumable_effects",
      "factions", "damage_types", "armor_resistance_profiles",
      "trade_commodities", "commodities", "contracts",
      "crafting_resources", "crafting_blueprints",
      "refining_processes",
    ];

    // Child tables without game_version_id — DELETE via FK to parent
    // Must be deleted BEFORE their parents to avoid FK constraint errors
    const deleteStatements: D1PreparedStatement[] = [];

    // Delete child tables first (no game_version_id — delete via FK to versioned parent)
    // Order matters: deepest children first

    // crafting_slot_modifiers → crafting_blueprint_slots → crafting_blueprints (versioned)
    deleteStatements.push(
      db.prepare(
        `DELETE FROM crafting_slot_modifiers WHERE crafting_blueprint_slot_id IN (
          SELECT id FROM crafting_blueprint_slots WHERE crafting_blueprint_id IN (
            SELECT id FROM crafting_blueprints WHERE game_version_id = ?
          )
        )`
      ).bind(versionId)
    );
    deleteStatements.push(
      db.prepare(
        `DELETE FROM crafting_blueprint_slots WHERE crafting_blueprint_id IN (
          SELECT id FROM crafting_blueprints WHERE game_version_id = ?
        )`
      ).bind(versionId)
    );

    // mining_location_deposits → mining_locations (versioned)
    deleteStatements.push(
      db.prepare(
        `DELETE FROM mining_location_deposits WHERE mining_location_id IN (
          SELECT id FROM mining_locations WHERE game_version_id = ?
        )`
      ).bind(versionId)
    );

    // salvageable_ship_components → salvageable_ships (versioned)
    deleteStatements.push(
      db.prepare(
        `DELETE FROM salvageable_ship_components WHERE salvageable_ship_id IN (
          SELECT id FROM salvageable_ships WHERE game_version_id = ?
        )`
      ).bind(versionId)
    );

    // Then delete versioned tables
    for (const t of versionedTables) {
      deleteStatements.push(
        db.prepare(`DELETE FROM ${t} WHERE game_version_id = ?`).bind(versionId)
      );
    }

    // Clean up npc_factions — lookup table, no game_version_id.
    // Runs after npc_loadouts are deleted so orphaned factions get removed.
    deleteStatements.push(
      db.prepare("DELETE FROM npc_factions WHERE id NOT IN (SELECT DISTINCT faction_id FROM npc_loadouts WHERE faction_id IS NOT NULL)")
    );

    // Clear build_number so the row is hidden from dropdown
    deleteStatements.push(
      db.prepare("UPDATE game_versions SET build_number = NULL WHERE id = ?").bind(versionId)
    );

    try {
      await db.batch(deleteStatements);
    } catch (err) {
      console.error("[admin/ptu-purge] batch failed:", err);
      return c.json({ error: `Purge failed: ${String(err)}` }, 500);
    }

    // Purge KV cache
    const kv = c.env.SC_BRIDGE_CACHE;
    await purgeByPrefix(kv);

    return c.json({ ok: true, tables_purged: versionedTables.length + 4, channel }); // +4 child tables
  });

  /**
   * PUT /api/admin/versions/ptu/build
   *
   * Update the build number (and optionally the code) for a PTU/EPTU version.
   * Used after loading new PTU data to record which build the data is from.
   */
  routes.put("/versions/ptu/build",
    validate("json", z.object({
      channel: z.enum(["PTU", "EPTU"]),
      build_number: z.string().min(1).max(50),
      code: z.string().min(1).max(100).optional(),
    })),
    async (c) => {
    const { channel, build_number, code } = c.req.valid("json");
    const db = c.env.DB;

    // Find or create the canonical row for this channel
    let version = await db
      .prepare("SELECT id, code FROM game_versions WHERE channel = ?")
      .bind(channel)
      .first<{ id: number; code: string }>();

    if (!version && code) {
      // Create the PTU row if it doesn't exist yet
      const uuid = `${code}-${build_number}`;
      await db
        .prepare("INSERT INTO game_versions (uuid, code, channel, is_default, build_number) VALUES (?, ?, ?, 0, ?)")
        .bind(uuid, code, channel, build_number)
        .run();
      version = await db
        .prepare("SELECT id, code FROM game_versions WHERE channel = ?")
        .bind(channel)
        .first<{ id: number; code: string }>();
    }

    if (!version) {
      return c.json({ error: `No ${channel} version row found. Provide 'code' to create one.` }, 404);
    }

    const updates: D1PreparedStatement[] = [
      db.prepare("UPDATE game_versions SET build_number = ? WHERE id = ?").bind(build_number, version.id),
    ];

    if (code && code !== version.code) {
      updates.push(
        db.prepare("UPDATE game_versions SET code = ? WHERE id = ?").bind(code, version.id)
      );
    }

    await db.batch(updates);

    // Purge KV cache
    const kv = c.env.SC_BRIDGE_CACHE;
    await purgeByPrefix(kv);

    return c.json({ ok: true, code: code || version.code, build_number, channel });
  });

  return routes;
}
