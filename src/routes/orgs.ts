import { Hono } from "hono";
import { z } from "zod";
import type { HonoEnv, UserFleetEntry, Vehicle } from "../lib/types";
import { validate } from "../lib/validation";
import { analyzeFleet } from "./analysis";
import { VEHICLE_VERSION_JOIN } from "../lib/constants";

/**
 * /api/orgs/* — Organisation endpoints
 *
 * Core org operations (create, invite, accept) are handled by Better Auth's
 * organization plugin at /api/auth/organization/*. These routes cover
 * fleet-specific and public-facing endpoints that Better Auth doesn't provide.
 */
export function orgRoutes() {
  const routes = new Hono<HonoEnv>();

  // GET /api/orgs — list orgs the authenticated user belongs to
  routes.get("/", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const db = c.env.DB;

    const orgs = await db
      .prepare(
        `SELECT o.id, o.name, o.slug, o.logo, o.rsiSid, o.rsiUrl, mb.role,
          COUNT(DISTINCT m2.userId) as memberCount
        FROM organization o
        JOIN member mb ON mb.organizationId = o.id AND mb.userId = ?
        LEFT JOIN member m2 ON m2.organizationId = o.id
        GROUP BY o.id, o.name, o.slug, o.logo, o.rsiSid, o.rsiUrl, mb.role
        ORDER BY o.name`,
      )
      .bind(user.id)
      .all();

    return c.json({ orgs: orgs.results });
  });

  // GET /api/orgs/:slug — org profile (members only)
  routes.get("/:slug", async (c) => {
    const slug = c.req.param("slug");
    const db = c.env.DB;
    const user = c.get("user");

    if (!user) return c.json({ error: "Not found" }, 404);

    const org = await db
      .prepare("SELECT id, name, slug, logo, description, rsiSid, rsiUrl, homepage, discord, twitch, youtube, createdAt FROM organization WHERE slug = ?")
      .bind(slug)
      .first<{
        id: string; name: string; slug: string; logo: string | null;
        description: string | null;
        rsiSid: string | null; rsiUrl: string | null; homepage: string | null;
        discord: string | null; twitch: string | null; youtube: string | null;
        createdAt: string;
      }>();

    if (!org) return c.json({ error: "Not found" }, 404);

    // Only members can view org profiles
    const membership = await db
      .prepare("SELECT role FROM member WHERE organizationId = ? AND userId = ?")
      .bind(org.id, user.id)
      .first<{ role: string }>();
    if (!membership) return c.json({ error: "Not found" }, 404);

    const memberCount = await db
      .prepare("SELECT COUNT(*) as count FROM member WHERE organizationId = ?")
      .bind(org.id)
      .first<{ count: number }>();

    return c.json({
      ...org,
      memberCount: memberCount?.count ?? 0,
      callerRole: membership.role,
    });
  });

  // PATCH /api/orgs/:slug — update org settings (owner/admin only)
  routes.patch("/:slug",
    validate("json", z.object({
      description: z.string().max(500).nullable().optional(),
      rsiSid: z.string().max(20).nullable().optional(),
      rsiUrl: z.string().url().max(200).refine(v => /^https?:\/\//i.test(v), "Must be http/https URL").nullable().optional(),
      homepage: z.string().url().max(200).refine(v => /^https?:\/\//i.test(v), "Must be http/https URL").nullable().optional(),
      discord: z.string().url().max(200).refine(v => /^https?:\/\//i.test(v), "Must be http/https URL").nullable().optional(),
      twitch: z.string().url().max(200).refine(v => /^https?:\/\//i.test(v), "Must be http/https URL").nullable().optional(),
      youtube: z.string().url().max(200).refine(v => /^https?:\/\//i.test(v), "Must be http/https URL").nullable().optional(),
    }).strict()),
    async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const slug = c.req.param("slug");
    const db = c.env.DB;

    const org = await db
      .prepare("SELECT id FROM organization WHERE slug = ?")
      .bind(slug)
      .first<{ id: string }>();
    if (!org) return c.json({ error: "Not found" }, 404);

    const membership = await db
      .prepare("SELECT role FROM member WHERE organizationId = ? AND userId = ?")
      .bind(org.id, user.id)
      .first<{ role: string }>();
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      return c.json({ error: "Forbidden — owner or admin role required" }, 403);
    }

    const body = c.req.valid("json");
    const ALLOWED_COLUMNS = new Set(["description", "rsiSid", "rsiUrl", "homepage", "discord", "twitch", "youtube"]);
    const updates: string[] = [];
    const values: (string | null)[] = [];

    for (const [key, val] of Object.entries(body)) {
      if (val !== undefined && ALLOWED_COLUMNS.has(key)) {
        updates.push(`${key} = ?`);
        values.push(val);
      }
    }

    if (updates.length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }

    values.push(org.id);
    await db
      .prepare(`UPDATE organization SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    return c.json({ ok: true });
  });

  // GET /api/orgs/:slug/fleet — visibility-gated org fleet
  routes.get("/:slug/fleet", async (c) => {
    const slug = c.req.param("slug");
    const db = c.env.DB;
    const user = c.get("user");

    const org = await db
      .prepare("SELECT id FROM organization WHERE slug = ?")
      .bind(slug)
      .first<{ id: string }>();
    if (!org) return c.json({ error: "Not found" }, 404);

    let callerRole: string | null = null;
    if (user) {
      const membership = await db
        .prepare("SELECT role FROM member WHERE organizationId = ? AND userId = ?")
        .bind(org.id, user.id)
        .first<{ role: string }>();
      callerRole = membership?.role ?? null;
    }

    // SAFETY: visibilityClause is built from callerRole which comes from the DB
    // (member.role column), not from user input. All branches produce static SQL
    // string literals, so this interpolation is not a SQL injection vector.
    let visibilityClause: string;
    if (callerRole === "owner" || callerRole === "admin") {
      visibilityClause = "uf.org_visibility IN ('public', 'org', 'officers')";
    } else if (callerRole === "member") {
      visibilityClause = "uf.org_visibility IN ('public', 'org')";
    } else {
      visibilityClause = "uf.org_visibility = 'public'";
    }

    const fleet = await db
      .prepare(
        `SELECT uf.id, uf.user_id, uf.vehicle_id, uf.custom_name,
          uf.org_visibility, uf.available_for_ops,
          v.name as vehicle_name, v.slug as vehicle_slug, v.focus, v.size_label, v.cargo,
          v.crew_min, v.crew_max, v.pledge_price, v.image_url,
          m.name as manufacturer_name, m.code as manufacturer_code,
          ps.key as production_status,
          u.name as owner_name
        FROM user_fleet uf
        JOIN member mb ON mb.userId = uf.user_id AND mb.organizationId = ?
        JOIN vehicles v ON v.id = uf.vehicle_id
        JOIN user u ON u.id = uf.user_id
        LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
        LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
        WHERE ${visibilityClause}
        ORDER BY v.name`,
      )
      .bind(org.id)
      .all();

    return c.json({ fleet: fleet.results, callerRole });
  });

  // GET /api/orgs/:slug/members — member list (org members only)
  routes.get("/:slug/members", async (c) => {
    const slug = c.req.param("slug");
    const db = c.env.DB;
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const org = await db
      .prepare("SELECT id FROM organization WHERE slug = ?")
      .bind(slug)
      .first<{ id: string }>();
    if (!org) return c.json({ error: "Not found" }, 404);

    const membership = await db
      .prepare("SELECT role FROM member WHERE organizationId = ? AND userId = ?")
      .bind(org.id, user.id)
      .first<{ role: string }>();
    if (!membership) return c.json({ error: "Forbidden" }, 403);

    const members = await db
      .prepare(
        `SELECT mb.id, mb.userId, mb.organizationId, mb.role, mb.createdAt,
          u.name as userName, u.image as userImage
        FROM member mb
        JOIN user u ON u.id = mb.userId
        WHERE mb.organizationId = ?
        ORDER BY mb.createdAt`,
      )
      .bind(org.id)
      .all();

    return c.json({ members: members.results });
  });

  // GET /api/orgs/:slug/analysis — gap analysis on org fleet (org members only)
  routes.get("/:slug/analysis", async (c) => {
    const slug = c.req.param("slug");
    const db = c.env.DB;
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const org = await db
      .prepare("SELECT id FROM organization WHERE slug = ?")
      .bind(slug)
      .first<{ id: string }>();
    if (!org) return c.json({ error: "Not found" }, 404);

    const membership = await db
      .prepare("SELECT role FROM member WHERE organizationId = ? AND userId = ?")
      .bind(org.id, user.id)
      .first<{ role: string }>();
    if (!membership) return c.json({ error: "Forbidden" }, 403);

    // SAFETY: see fleet endpoint above — callerRole from DB, static SQL literals only
    const callerRole = membership.role;
    let visibilityClause: string;
    if (callerRole === "owner" || callerRole === "admin") {
      visibilityClause = "uf.org_visibility IN ('public', 'org', 'officers')";
    } else {
      visibilityClause = "uf.org_visibility IN ('public', 'org')";
    }

    const fleetResult = await db
      .prepare(
        `SELECT uf.id, uf.vehicle_id, uf.warbond, uf.is_loaner,
          v.name as vehicle_name, v.slug as vehicle_slug, v.focus, v.size_label, v.cargo,
          v.crew_min, v.crew_max, v.speed_scm, v.classification,
          m.name as manufacturer_name, m.code as manufacturer_code,
          it.label as insurance_label, it.duration_months, it.is_lifetime,
          ps.key as production_status
        FROM user_fleet uf
        JOIN member mb ON mb.userId = uf.user_id AND mb.organizationId = ?
        JOIN vehicles v ON v.id = uf.vehicle_id
        LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
        LEFT JOIN insurance_types it ON it.id = uf.insurance_type_id
        LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
        WHERE ${visibilityClause}
        ORDER BY v.name`,
      )
      .bind(org.id)
      .all();

    const allVehiclesResult = await db
      .prepare(
        `SELECT v.id, v.slug, v.name, v.focus, v.size_label, v.classification,
          ps.key as production_status
        FROM vehicles v
        ${VEHICLE_VERSION_JOIN}
        LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
        ORDER BY v.name`,
      )
      .all();

    const analysis = analyzeFleet(
      fleetResult.results as unknown as UserFleetEntry[],
      allVehiclesResult.results as unknown as Vehicle[],
    );
    return c.json(analysis);
  });

  // GET /api/orgs/:slug/stats — org fleet stats (members only)
  routes.get("/:slug/stats", async (c) => {
    const slug = c.req.param("slug");
    const db = c.env.DB;
    const user = c.get("user");

    if (!user) return c.json({ error: "Not found" }, 404);

    const org = await db
      .prepare("SELECT id FROM organization WHERE slug = ?")
      .bind(slug)
      .first<{ id: string }>();
    if (!org) return c.json({ error: "Not found" }, 404);

    const membership = await db
      .prepare("SELECT role FROM member WHERE organizationId = ? AND userId = ?")
      .bind(org.id, user.id)
      .first<{ role: string }>();
    if (!membership) return c.json({ error: "Not found" }, 404);

    const stats = await db
      .prepare(
        `SELECT
          COUNT(uf.id) as total_ships,
          COALESCE(SUM(v.cargo), 0) as total_cargo,
          COALESCE(SUM(v.crew_min), 0) as min_crew,
          COALESCE(SUM(v.crew_max), 0) as max_crew,
          COUNT(DISTINCT uf.user_id) as contributing_members
        FROM user_fleet uf
        JOIN member mb ON mb.userId = uf.user_id AND mb.organizationId = ?
        JOIN vehicles v ON v.id = uf.vehicle_id
        WHERE uf.org_visibility = 'public'`,
      )
      .bind(org.id)
      .first();

    return c.json({ stats });
  });

  // POST /api/orgs/:slug/verify-rsi/generate — generate a verification key (owner only)
  routes.post("/:slug/verify-rsi/generate",
    validate("json", z.object({
      rsiSid: z.string().min(2).max(20).regex(/^[A-Za-z0-9_-]+$/, "Invalid RSI org SID"),
    })),
    async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const slug = c.req.param("slug");
    const db = c.env.DB;
    const body = c.req.valid("json");

    const org = await db
      .prepare("SELECT id, rsiSid, verified_at FROM organization WHERE slug = ?")
      .bind(slug)
      .first<{ id: string; rsiSid: string | null; verified_at: string | null }>();
    if (!org) return c.json({ error: "Not found" }, 404);

    const membership = await db
      .prepare("SELECT role FROM member WHERE organizationId = ? AND userId = ?")
      .bind(org.id, user.id)
      .first<{ role: string }>();
    if (!membership || membership.role !== "owner") {
      return c.json({ error: "Forbidden — owner role required" }, 403);
    }

    if (org.verified_at) {
      return c.json({ error: "Org is already verified" }, 400);
    }

    // Generate a random verification key
    const keyBytes = new Uint8Array(16);
    crypto.getRandomValues(keyBytes);
    const verificationKey = `scbridge-verify-${Array.from(keyBytes).map(b => b.toString(16).padStart(2, "0")).join("")}`;

    // Store key and RSI SID on the org
    await db
      .prepare("UPDATE organization SET verification_key = ?, rsiSid = ? WHERE id = ?")
      .bind(verificationKey, body.rsiSid.toUpperCase(), org.id)
      .run();

    return c.json({
      ok: true,
      verification_key: verificationKey,
      rsiSid: body.rsiSid.toUpperCase(),
      instructions: `Add this key anywhere in your RSI org charter at https://robertsspaceindustries.com/en/orgs/${body.rsiSid.toUpperCase()}, then click Verify.`,
    });
  });

  // POST /api/orgs/:slug/verify-rsi/check — check if the key is in the RSI charter (owner only)
  routes.post("/:slug/verify-rsi/check", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const slug = c.req.param("slug");
    const db = c.env.DB;

    const org = await db
      .prepare("SELECT id, rsiSid, verification_key, verified_at FROM organization WHERE slug = ?")
      .bind(slug)
      .first<{ id: string; rsiSid: string | null; verification_key: string | null; verified_at: string | null }>();
    if (!org) return c.json({ error: "Not found" }, 404);

    const membership = await db
      .prepare("SELECT role FROM member WHERE organizationId = ? AND userId = ?")
      .bind(org.id, user.id)
      .first<{ role: string }>();
    if (!membership || membership.role !== "owner") {
      return c.json({ error: "Forbidden — owner role required" }, 403);
    }

    if (org.verified_at) {
      return c.json({ error: "Org is already verified" }, 400);
    }

    if (!org.verification_key || !org.rsiSid) {
      return c.json({ error: "No verification key generated — generate one first" }, 400);
    }

    // Fetch the RSI org page and check charter content
    const rsiUrl = `https://robertsspaceindustries.com/en/orgs/${encodeURIComponent(org.rsiSid)}`;
    let html: string;
    try {
      const resp = await fetch(rsiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html",
        },
      });
      if (!resp.ok) {
        return c.json({ error: `RSI returned ${resp.status} — check the org SID is correct` }, 502);
      }
      html = await resp.text();
    } catch (err) {
      return c.json({ error: "Failed to reach RSI — try again later" }, 502);
    }

    // Extract the charter tab content
    const charterMatch = html.match(/id="tab-charter"[\s\S]*?<div class="markitup-text">([\s\S]*?)<\/div>/);
    if (!charterMatch) {
      return c.json({
        ok: false,
        verified: false,
        message: "Could not find a charter section on the RSI org page. Make sure the org has a charter.",
      });
    }

    const charterContent = charterMatch[1];
    if (!charterContent.includes(org.verification_key)) {
      return c.json({
        ok: false,
        verified: false,
        message: `Verification key not found in charter. Add "${org.verification_key}" to your org charter at ${rsiUrl}, save it, then try again.`,
      });
    }

    // Verified — mark the org
    await db
      .prepare("UPDATE organization SET verified_at = datetime('now'), verified_by = ? WHERE id = ?")
      .bind(user.id, org.id)
      .run();

    return c.json({
      ok: true,
      verified: true,
      message: "Org verified successfully! You can now remove the key from your charter.",
    });
  });

  // GET /api/orgs/:slug/verify-rsi/status — check verification status (members)
  routes.get("/:slug/verify-rsi/status", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const slug = c.req.param("slug");
    const db = c.env.DB;

    const org = await db
      .prepare("SELECT id, rsiSid, verification_key, verified_at FROM organization WHERE slug = ?")
      .bind(slug)
      .first<{ id: string; rsiSid: string | null; verification_key: string | null; verified_at: string | null }>();
    if (!org) return c.json({ error: "Not found" }, 404);

    const membership = await db
      .prepare("SELECT role FROM member WHERE organizationId = ? AND userId = ?")
      .bind(org.id, user.id)
      .first<{ role: string }>();
    if (!membership) return c.json({ error: "Not found" }, 404);

    return c.json({
      verified: !!org.verified_at,
      verified_at: org.verified_at,
      rsiSid: org.rsiSid,
      // Only show the key to the owner
      verification_key: membership.role === "owner" ? org.verification_key : undefined,
      has_key: !!org.verification_key,
    });
  });

  return routes;
}
