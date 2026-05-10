import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { setupTestDatabase } from "./apply-migrations";
import { createTestUser, authHeaders } from "./helpers";

/**
 * Generalised manual match — covers paint, fps_weapon, fps_armour,
 * fps_helmet, vehicle_component. Single picker / endpoint shape per
 * kind. Replaces the paint-only flow from 0232.
 */
describe("Admin generic match", () => {
  let adminToken: string;
  let weaponCaptureId: number;
  let armourCaptureId: number;
  let weaponId: number;
  let armourId: number;

  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    const admin = await createTestUser(env.DB, { role: "super_admin" });
    adminToken = admin.sessionToken;

    const w = await env.DB.prepare(
      `INSERT INTO fps_weapons (uuid, name, slug, class_name, sub_type, game_version_id)
       VALUES ('w-uuid-1', 'P8-AR Blackguard Rifle', 'p8-ar-blackguard',
               'p8ar_blackguard', 'assault', 1)
       RETURNING id`,
    ).first<{ id: number }>();
    weaponId = w!.id;

    const a = await env.DB.prepare(
      `INSERT INTO fps_armour (uuid, name, slug, class_name, sub_type, game_version_id)
       VALUES ('a-uuid-1', 'Chiron Core AA Support', 'chiron-core-aa',
               'armor_chiron_core_aa', 'medium', 1)
       RETURNING id`,
    ).first<{ id: number }>();
    armourId = a!.id;

    const wc = await env.DB.prepare(
      `INSERT INTO image_captures (url, source, title, kind, promoted, seen_count, title_norm)
       VALUES ('https://media.example.com/weapon-cap.jpg', 'hangar_sync',
               'P8-AR Rifle Weird Pledge Name', 'FPS Equipment', 0, 9999,
               'p8 ar rifle weird pledge name')
       RETURNING id`,
    ).first<{ id: number }>();
    weaponCaptureId = wc!.id;

    const ac = await env.DB.prepare(
      `INSERT INTO image_captures (url, source, title, kind, promoted, seen_count, title_norm)
       VALUES ('https://media.example.com/armour-cap.jpg', 'hangar_sync',
               'Chiron - Specific Pledge Name', 'FPS Equipment', 0, 9998,
               'chiron specific pledge name')
       RETURNING id`,
    ).first<{ id: number }>();
    armourCaptureId = ac!.id;
  });

  describe("GET /api/admin/match-search", () => {
    it("rejects unknown kind", async () => {
      const res = await SELF.fetch(
        "http://localhost/api/admin/match-search?kind=nonsense&q=test",
        { headers: await authHeaders(adminToken) },
      );
      expect(res.status).toBe(400);
    });

    it("rejects empty query", async () => {
      const res = await SELF.fetch(
        "http://localhost/api/admin/match-search?kind=fps_weapon&q=",
        { headers: await authHeaders(adminToken) },
      );
      expect(res.status).toBe(400);
    });

    it("searches fps_weapons by name", async () => {
      const res = await SELF.fetch(
        "http://localhost/api/admin/match-search?kind=fps_weapon&q=blackguard",
        { headers: await authHeaders(adminToken) },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { results: Array<{ id: number; name: string }> };
      expect(body.results.find((r) => r.id === weaponId)).toBeTruthy();
    });

    it("searches fps_armour by name", async () => {
      const res = await SELF.fetch(
        "http://localhost/api/admin/match-search?kind=fps_armour&q=chiron",
        { headers: await authHeaders(adminToken) },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { results: Array<{ id: number }> };
      expect(body.results.find((r) => r.id === armourId)).toBeTruthy();
    });

    it("searches paint kind via the same generic endpoint", async () => {
      // Seed a paint
      await env.DB.prepare(
        `INSERT OR IGNORE INTO paints (name, slug, class_name, image_url, game_version_id, title_norm)
         VALUES ('Test Search Paint Livery', 'test-search-paint',
                 'paint_test_search', 'https://imagedelivery.net/abc/x/public', 1,
                 'test search paint livery')`,
      ).run();

      const res = await SELF.fetch(
        "http://localhost/api/admin/match-search?kind=paint&q=test+search",
        { headers: await authHeaders(adminToken) },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { results: Array<{ name: string }> };
      const found = body.results.find((r) => r.name === "Test Search Paint Livery");
      expect(found).toBeTruthy();
    });
  });

  describe("PATCH /api/admin/image-captures/:id/match", () => {
    it("links a capture to an fps_weapon", async () => {
      const res = await SELF.fetch(
        `http://localhost/api/admin/image-captures/${weaponCaptureId}/match`,
        {
          method: "PATCH",
          headers: {
            ...(await authHeaders(adminToken)),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ kind: "fps_weapon", id: weaponId }),
        },
      );
      expect(res.status).toBe(200);

      const row = await env.DB.prepare(
        "SELECT manual_match_kind, manual_match_id FROM image_captures WHERE id = ?",
      ).bind(weaponCaptureId).first<{ manual_match_kind: string; manual_match_id: number }>();
      expect(row?.manual_match_kind).toBe("fps_weapon");
      expect(row?.manual_match_id).toBe(weaponId);
    });

    it("rejects unknown kind", async () => {
      const res = await SELF.fetch(
        `http://localhost/api/admin/image-captures/${weaponCaptureId}/match`,
        {
          method: "PATCH",
          headers: {
            ...(await authHeaders(adminToken)),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ kind: "fake_kind", id: 1 }),
        },
      );
      expect(res.status).toBe(400);
    });

    it("rejects unknown row in the target table", async () => {
      const res = await SELF.fetch(
        `http://localhost/api/admin/image-captures/${weaponCaptureId}/match`,
        {
          method: "PATCH",
          headers: {
            ...(await authHeaders(adminToken)),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ kind: "fps_weapon", id: 9999999 }),
        },
      );
      expect(res.status).toBe(404);
    });

    it("clears the link with kind: null", async () => {
      // Set first
      await env.DB.prepare(
        "UPDATE image_captures SET manual_match_kind = 'fps_weapon', manual_match_id = ? WHERE id = ?",
      ).bind(weaponId, weaponCaptureId).run();

      const res = await SELF.fetch(
        `http://localhost/api/admin/image-captures/${weaponCaptureId}/match`,
        {
          method: "PATCH",
          headers: {
            ...(await authHeaders(adminToken)),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ kind: null, id: null }),
        },
      );
      expect(res.status).toBe(200);

      const row = await env.DB.prepare(
        "SELECT manual_match_kind, manual_match_id FROM image_captures WHERE id = ?",
      ).bind(weaponCaptureId).first<{ manual_match_kind: string | null; manual_match_id: number | null }>();
      expect(row?.manual_match_kind).toBeNull();
      expect(row?.manual_match_id).toBeNull();
    });
  });

  describe("Captures filter respects polymorphic match", () => {
    it("hides FPS Equipment captures linked to fps_weapons", async () => {
      await env.DB.prepare(
        "UPDATE image_captures SET manual_match_kind = 'fps_weapon', manual_match_id = ? WHERE id = ?",
      ).bind(weaponId, weaponCaptureId).run();

      const res = await SELF.fetch(
        "http://localhost/api/admin/image-captures?promoted=0&kind=FPS+Equipment",
        { headers: await authHeaders(adminToken) },
      );
      const body = (await res.json()) as { captures: Array<{ id: number }> };
      expect(body.captures.find((c) => c.id === weaponCaptureId)).toBeUndefined();
    });
  });

  describe("Captures response surfaces matched_kind + matched_id + matched_name", () => {
    it("returns the resolved match info", async () => {
      // Link to armour
      await env.DB.prepare(
        "UPDATE image_captures SET manual_match_kind = 'fps_armour', manual_match_id = ? WHERE id = ?",
      ).bind(armourId, armourCaptureId).run();

      const res = await SELF.fetch(
        "http://localhost/api/admin/image-captures?promoted=0&show_all=1&kind=FPS+Equipment",
        { headers: await authHeaders(adminToken) },
      );
      const body = (await res.json()) as {
        captures: Array<{
          id: number;
          matched_kind: string | null;
          matched_id: number | null;
          matched_name: string | null;
        }>;
      };
      const cap = body.captures.find((c) => c.id === armourCaptureId);
      expect(cap).toBeTruthy();
      expect(cap!.matched_kind).toBe("fps_armour");
      expect(cap!.matched_id).toBe(armourId);
      expect(cap!.matched_name).toBe("Chiron Core AA Support");
    });
  });
});
