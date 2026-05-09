import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { setupTestDatabase } from "./apply-migrations";
import { createTestUser, authHeaders } from "./helpers";

/**
 * pledge_item_media — canonical CF-hosted image per pledge-item title.
 * Provides a fallback image source for the Hangar UI when the
 * extension's scrape didn't capture one.
 */
describe("pledge_item_media + Hangar API title-fallback", () => {
  let sessionToken: string;
  let userId: string;
  let pledgeId: number;

  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    const user = await createTestUser(env.DB);
    sessionToken = user.sessionToken;
    userId = user.userId;

    const sync = await env.DB.prepare(
      `INSERT INTO user_hangar_syncs (user_id, source) VALUES (?, 'extension') RETURNING id`,
    ).bind(userId).first<{ id: number }>();

    const pledge = await env.DB.prepare(
      `INSERT INTO user_pledges (user_id, sync_id, rsi_pledge_id, name)
       VALUES (?, ?, 555001, 'Test Pledge') RETURNING id`,
    ).bind(userId, sync!.id).first<{ id: number }>();
    pledgeId = pledge!.id;

    // Seed three items: one with image_url, two without.
    // The two without will be the test cases for the fallback JOIN.
    await env.DB.prepare(
      `INSERT INTO user_pledge_items (user_id, user_pledge_id, title, kind, image_url, sort_order)
       VALUES (?, ?, 'Carrack', 'Ship', 'https://media.example.com/carrack.jpg', 0)`,
    ).bind(userId, pledgeId).run();
    await env.DB.prepare(
      `INSERT INTO user_pledge_items (user_id, user_pledge_id, title, kind, image_url, sort_order)
       VALUES (?, ?, 'Self-Land Hangar', 'Hangar decoration', NULL, 1)`,
    ).bind(userId, pledgeId).run();
    await env.DB.prepare(
      `INSERT INTO user_pledge_items (user_id, user_pledge_id, title, kind, image_url, sort_order)
       VALUES (?, ?, 'Geist Armor Core Epoque', 'FPS Equipment', NULL, 2)`,
    ).bind(userId, pledgeId).run();
  });

  describe("/api/hangar fallback to pledge_item_media", () => {
    it("returns NULL image_url for items without scrape OR media entry", async () => {
      const res = await SELF.fetch("http://localhost/api/hangar", {
        headers: await authHeaders(sessionToken),
      });
      const body = (await res.json()) as { items: Array<{ title: string; image_url: string | null }> };
      const hangar = body.items.find((i) => i.title === "Self-Land Hangar");
      expect(hangar).toBeTruthy();
      expect(hangar!.image_url).toBeNull();
    });

    it("falls back to pledge_item_media.cf_image_url when scrape image_url is NULL", async () => {
      // Seed a pledge_item_media row for Self-Land Hangar
      await env.DB.prepare(
        `INSERT INTO pledge_item_media (title, title_lower, cf_image_id, cf_image_url)
         VALUES ('Self-Land Hangar', 'self-land hangar',
                 'cf-img-id-1', 'https://imagedelivery.net/abc/cf-img-id-1/public')`,
      ).run();

      const res = await SELF.fetch("http://localhost/api/hangar", {
        headers: await authHeaders(sessionToken),
      });
      const body = (await res.json()) as { items: Array<{ title: string; image_url: string | null }> };
      const hangar = body.items.find((i) => i.title === "Self-Land Hangar");
      expect(hangar!.image_url).toBe("https://imagedelivery.net/abc/cf-img-id-1/public");
    });

    it("title match is case-insensitive", async () => {
      // Seed media row with lowercase title_lower; pledge item has mixed case
      await env.DB.prepare(
        `INSERT INTO pledge_item_media (title, title_lower, cf_image_id, cf_image_url)
         VALUES ('geist armor core epoque', 'geist armor core epoque',
                 'cf-img-id-2', 'https://imagedelivery.net/abc/cf-img-id-2/public')`,
      ).run();

      const res = await SELF.fetch("http://localhost/api/hangar", {
        headers: await authHeaders(sessionToken),
      });
      const body = (await res.json()) as { items: Array<{ title: string; image_url: string | null }> };
      const armour = body.items.find((i) => i.title === "Geist Armor Core Epoque");
      expect(armour!.image_url).toBe("https://imagedelivery.net/abc/cf-img-id-2/public");
    });

    it("scrape image_url takes precedence over pledge_item_media", async () => {
      // Seed a media entry for Carrack (which already has scrape image_url)
      await env.DB.prepare(
        `INSERT INTO pledge_item_media (title, title_lower, cf_image_id, cf_image_url)
         VALUES ('Carrack', 'carrack', 'cf-fallback', 'https://imagedelivery.net/abc/cf-fallback/public')
         ON CONFLICT(title_lower) DO NOTHING`,
      ).run();

      const res = await SELF.fetch("http://localhost/api/hangar", {
        headers: await authHeaders(sessionToken),
      });
      const body = (await res.json()) as { items: Array<{ title: string; image_url: string | null }> };
      const carrack = body.items.find((i) => i.title === "Carrack");
      expect(carrack!.image_url).toBe("https://media.example.com/carrack.jpg");
    });
  });

  describe("admin endpoints", () => {
    let adminToken: string;

    beforeAll(async () => {
      const admin = await createTestUser(env.DB, { role: "super_admin" });
      adminToken = admin.sessionToken;
    });

    it("GET /api/admin/item-media — lists entries with reference_count", async () => {
      // Seed a known media entry to look up
      await env.DB.prepare(
        `INSERT INTO pledge_item_media (title, title_lower, cf_image_id, cf_image_url)
         VALUES ('Admin List Probe', 'admin list probe', 'cf-probe', 'https://imagedelivery.net/abc/cf-probe/public')
         ON CONFLICT(title_lower) DO NOTHING`,
      ).run();

      const res = await SELF.fetch("http://localhost/api/admin/item-media", {
        headers: await authHeaders(adminToken),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        items: Array<{ title: string; title_lower: string; reference_count: number }>;
      };
      const probe = body.items.find((m) => m.title_lower === "admin list probe");
      expect(probe).toBeTruthy();
      expect(probe!.title).toBe("Admin List Probe");
      // Sanity: reference_count is a number (likely 0 since no user_pledge_items row matches)
      expect(typeof probe!.reference_count).toBe("number");
    });

    it("GET /api/admin/item-media/gap-titles — surfaces titles with no fallback yet", async () => {
      // Seed a gap title (no image_url, no media entry)
      const sync = await env.DB.prepare(
        `INSERT INTO user_hangar_syncs (user_id, source) VALUES (?, 'extension') RETURNING id`,
      ).bind(userId).first<{ id: number }>();
      const pledge = await env.DB.prepare(
        `INSERT INTO user_pledges (user_id, sync_id, rsi_pledge_id, name)
         VALUES (?, ?, 555099, 'Gap Pledge') RETURNING id`,
      ).bind(userId, sync!.id).first<{ id: number }>();
      await env.DB.prepare(
        `INSERT INTO user_pledge_items (user_id, user_pledge_id, title, kind, image_url, sort_order)
         VALUES (?, ?, 'Aeroview Hangar', 'Hangar decoration', NULL, 0)`,
      ).bind(userId, pledge!.id).run();

      const res = await SELF.fetch("http://localhost/api/admin/item-media/gap-titles", {
        headers: await authHeaders(adminToken),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        titles: Array<{ title: string; missing_count: number; kind: string }>;
      };
      const aeroview = body.titles.find((t) => t.title === "Aeroview Hangar");
      expect(aeroview).toBeTruthy();
      expect(aeroview!.missing_count).toBeGreaterThanOrEqual(1);
    });

    it("DELETE /api/admin/item-media/:id — removes a media entry", async () => {
      const inserted = await env.DB.prepare(
        `INSERT INTO pledge_item_media (title, title_lower, cf_image_id, cf_image_url)
         VALUES ('To-Delete Item', 'to-delete item', 'cf-del', 'https://imagedelivery.net/abc/cf-del/public')
         RETURNING id`,
      ).first<{ id: number }>();

      const res = await SELF.fetch(
        `http://localhost/api/admin/item-media/${inserted!.id}`,
        {
          method: "DELETE",
          headers: {
            ...(await authHeaders(adminToken)),
            "Content-Length": "0",
          },
        },
      );
      expect(res.status).toBe(200);

      const after = await env.DB.prepare(
        "SELECT id FROM pledge_item_media WHERE id = ?",
      ).bind(inserted!.id).first();
      expect(after).toBeNull();
    });

    it("admin endpoints require super_admin auth", async () => {
      const res = await SELF.fetch("http://localhost/api/admin/item-media", {
        headers: await authHeaders(sessionToken), // regular user
      });
      // Either 401 (no auth) or 403 (wrong role)
      expect([401, 403]).toContain(res.status);
    });
  });

  describe("/api/admin/image-captures hides already-captured rows by default", () => {
    let adminToken: string;

    beforeAll(async () => {
      const admin = await createTestUser(env.DB, { role: "super_admin" });
      adminToken = admin.sessionToken;

      // Seed a media entry that previous tests' state may not have left in place
      await env.DB.prepare(
        `INSERT INTO pledge_item_media (title, title_lower, cf_image_id, cf_image_url)
         VALUES ('Filter Probe Item', 'filter probe item',
                 'cf-probe-filter', 'https://imagedelivery.net/abc/cf-probe-filter/public')
         ON CONFLICT(title_lower) DO NOTHING`,
      ).run();
    });

    it("hides captures with media; show_all=1 reveals them", async () => {
      // Seed an image_capture with high seen_count so it sorts to page 1
      await env.DB.prepare(
        `INSERT OR IGNORE INTO image_captures (url, source, title, kind, promoted, seen_count)
         VALUES ('https://media.example.com/filter-probe.jpg', 'hangar_sync',
                 'Filter Probe Item', 'Hangar decoration', 0, 9999)`,
      ).run();
      const cap = await env.DB.prepare(
        "SELECT id FROM image_captures WHERE title = 'Filter Probe Item'",
      ).first<{ id: number }>();
      expect(cap).toBeTruthy();
      const media = await env.DB.prepare(
        "SELECT id FROM pledge_item_media WHERE title_lower = 'filter probe item'",
      ).first();
      expect(media).toBeTruthy();

      // Default — should be hidden
      const hidden = await SELF.fetch(
        "http://localhost/api/admin/image-captures?promoted=0",
        { headers: await authHeaders(adminToken) },
      );
      expect(hidden.status).toBe(200);
      const hiddenBody = (await hidden.json()) as { captures: Array<{ id: number }> };
      expect(hiddenBody.captures.find((c) => c.id === cap!.id)).toBeUndefined();

      // show_all=1 — should reveal
      const all = await SELF.fetch(
        "http://localhost/api/admin/image-captures?promoted=0&show_all=1",
        { headers: await authHeaders(adminToken) },
      );
      expect(all.status).toBe(200);
      const allBody = (await all.json()) as { captures: Array<{ id: number }> };
      expect(allBody.captures.find((c) => c.id === cap!.id)).toBeTruthy();
    });

    it("still shows captures with no canonical image yet", async () => {
      // Seed a capture for a title that has no media + no vehicle
      await env.DB.prepare(
        `INSERT INTO image_captures (url, source, title, kind, promoted)
         VALUES ('https://media.example.com/test2.jpg', 'hangar_sync',
                 'Brand New Item No Media', 'Hangar decoration', 0)
         ON CONFLICT(url) DO NOTHING`,
      ).run();

      const res = await SELF.fetch(
        "http://localhost/api/admin/image-captures?promoted=0",
        { headers: await authHeaders(adminToken) },
      );
      const body = (await res.json()) as { captures: Array<{ title: string }> };
      const found = body.captures.find((c) => c.title === "Brand New Item No Media");
      expect(found).toBeTruthy();
    });
  });
});
