import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { setupTestDatabase } from "./apply-migrations";
import { createTestUser, authHeaders } from "./helpers";

/**
 * Admin paint match flow — closes the rename-divergence gap (e.g.
 * pledge "C8 Pisces - 2952 Best in Show Paint" → DB "C8 Pisces Red
 * Alert Livery") with a manual override. Admin searches the master
 * paint list, picks the right one, and the capture drops out of the
 * unseen view.
 */
describe("Admin paint match", () => {
  let adminToken: string;
  let captureId: number;
  let paintId: number;

  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    const admin = await createTestUser(env.DB, { role: "super_admin" });
    adminToken = admin.sessionToken;

    // Seed a paint with a CDN image (the canonical row that admin will pick)
    const paintRow = await env.DB.prepare(
      `INSERT INTO paints (name, slug, class_name, image_url, game_version_id, title_norm)
       VALUES ('C8 Pisces Red Alert Livery', 'c8-pisces-red-alert',
               'paint_pisces_bis2952_black_red',
               'https://imagedelivery.net/abc/redalert/public', 1,
               'c8 pisces red alert livery')
       RETURNING id`,
    ).first<{ id: number }>();
    paintId = paintRow!.id;

    // Seed an unmatched capture (rename divergence — pledge name doesn't match paint name)
    const capRow = await env.DB.prepare(
      `INSERT INTO image_captures (url, source, title, kind, promoted, seen_count, title_norm)
       VALUES ('https://media.example.com/pisces-bis.jpg', 'hangar_sync',
               'C8 Pisces - 2952 Best in Show Paint', 'Skin', 0, 50,
               'c8 pisces 2952 best in show livery')
       RETURNING id`,
    ).first<{ id: number }>();
    captureId = capRow!.id;
  });

  describe("GET /api/admin/paints/search", () => {
    it("returns matching paints by name fragment", async () => {
      const res = await SELF.fetch(
        "http://localhost/api/admin/paints/search?q=red+alert",
        { headers: await authHeaders(adminToken) },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        paints: Array<{ id: number; name: string; class_name: string; has_image: boolean }>;
      };
      const found = body.paints.find((p) => p.id === paintId);
      expect(found).toBeTruthy();
      expect(found!.name).toBe("C8 Pisces Red Alert Livery");
      expect(found!.has_image).toBe(true);
    });

    it("matches by class_name fragment too", async () => {
      const res = await SELF.fetch(
        "http://localhost/api/admin/paints/search?q=bis2952",
        { headers: await authHeaders(adminToken) },
      );
      const body = (await res.json()) as { paints: Array<{ id: number }> };
      expect(body.paints.find((p) => p.id === paintId)).toBeTruthy();
    });

    it("rejects empty query", async () => {
      const res = await SELF.fetch(
        "http://localhost/api/admin/paints/search?q=",
        { headers: await authHeaders(adminToken) },
      );
      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/admin/image-captures/:id/paint-match", () => {
    it("links a capture to a paint", async () => {
      const res = await SELF.fetch(
        `http://localhost/api/admin/image-captures/${captureId}/paint-match`,
        {
          method: "PATCH",
          headers: {
            ...(await authHeaders(adminToken)),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paint_id: paintId }),
        },
      );
      expect(res.status).toBe(200);

      // Verify DB was updated
      const row = await env.DB.prepare(
        "SELECT manual_paint_id FROM image_captures WHERE id = ?",
      ).bind(captureId).first<{ manual_paint_id: number }>();
      expect(row?.manual_paint_id).toBe(paintId);
    });

    it("rejects unknown paint_id", async () => {
      const res = await SELF.fetch(
        `http://localhost/api/admin/image-captures/${captureId}/paint-match`,
        {
          method: "PATCH",
          headers: {
            ...(await authHeaders(adminToken)),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paint_id: 9999999 }),
        },
      );
      expect(res.status).toBe(404);
    });

    it("clears the link with paint_id: null", async () => {
      // First set it
      await env.DB.prepare(
        "UPDATE image_captures SET manual_paint_id = ? WHERE id = ?",
      ).bind(paintId, captureId).run();

      const res = await SELF.fetch(
        `http://localhost/api/admin/image-captures/${captureId}/paint-match`,
        {
          method: "PATCH",
          headers: {
            ...(await authHeaders(adminToken)),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paint_id: null }),
        },
      );
      expect(res.status).toBe(200);

      const row = await env.DB.prepare(
        "SELECT manual_paint_id FROM image_captures WHERE id = ?",
      ).bind(captureId).first<{ manual_paint_id: number | null }>();
      expect(row?.manual_paint_id).toBeNull();
    });
  });

  describe("Captures filter respects manual_paint_id", () => {
    it("hides a capture once it's manually linked", async () => {
      // Confirm capture is present BEFORE linking (rename divergence — no auto-match)
      const beforeRes = await SELF.fetch(
        "http://localhost/api/admin/image-captures?promoted=0&kind=Skin",
        { headers: await authHeaders(adminToken) },
      );
      const before = (await beforeRes.json()) as { captures: Array<{ id: number }> };
      expect(before.captures.find((c) => c.id === captureId)).toBeTruthy();

      // Link it via the polymorphic columns (the filter checks these)
      await env.DB.prepare(
        `UPDATE image_captures
            SET manual_paint_id = ?, manual_match_kind = 'paint', manual_match_id = ?
          WHERE id = ?`,
      ).bind(paintId, paintId, captureId).run();

      // Now hidden
      const afterRes = await SELF.fetch(
        "http://localhost/api/admin/image-captures?promoted=0&kind=Skin",
        { headers: await authHeaders(adminToken) },
      );
      const after = (await afterRes.json()) as { captures: Array<{ id: number }> };
      expect(after.captures.find((c) => c.id === captureId)).toBeUndefined();
    });
  });

  describe("Captures response surfaces match info", () => {
    it("returns matched paint id + name for show_all view", async () => {
      // Ensure linked via the polymorphic columns (the response cascade reads these)
      await env.DB.prepare(
        `UPDATE image_captures
            SET manual_paint_id = ?, manual_match_kind = 'paint', manual_match_id = ?
          WHERE id = ?`,
      ).bind(paintId, paintId, captureId).run();

      const res = await SELF.fetch(
        "http://localhost/api/admin/image-captures?promoted=0&show_all=1&kind=Skin",
        { headers: await authHeaders(adminToken) },
      );
      const body = (await res.json()) as {
        captures: Array<{
          id: number;
          matched_paint_id: number | null;
          matched_paint_name: string | null;
        }>;
      };
      const cap = body.captures.find((c) => c.id === captureId);
      expect(cap).toBeTruthy();
      expect(cap!.matched_paint_id).toBe(paintId);
      expect(cap!.matched_paint_name).toBe("C8 Pisces Red Alert Livery");
    });
  });
});
