import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { setupTestDatabase } from "./apply-migrations";
import { createTestUser, authHeaders } from "./helpers";

describe("User Blueprints API", () => {
  let sessionToken: string;
  let userId: string;
  let craftingBlueprintId: number;

  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    const user = await createTestUser(env.DB);
    sessionToken = user.sessionToken;
    userId = user.userId;

    // Seed a game version + crafting blueprint for FK references
    await env.DB.prepare(
      `INSERT OR IGNORE INTO game_versions (id, code, is_default) VALUES (1, '4.7.0-live', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO crafting_blueprints (uuid, tag, name, type, sub_type, craft_time_seconds, game_version_id)
       VALUES ('test-bp-uuid', 'BP_TEST', 'Test Blueprint', 'weapons', 'rifle', 120, 1)`
    ).run();
    const bpRow = await env.DB.prepare(
      "SELECT id FROM crafting_blueprints WHERE uuid = 'test-bp-uuid'"
    ).first<{ id: number }>();
    craftingBlueprintId = bpRow!.id;
  });

  describe("GET /api/blueprints", () => {
    it("requires authentication", async () => {
      const res = await SELF.fetch("http://localhost/api/blueprints");
      expect(res.status).toBe(401);
    });

    it("returns empty list initially", async () => {
      const res = await SELF.fetch("http://localhost/api/blueprints", {
        headers: await authHeaders(sessionToken),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: unknown[] };
      expect(body.items).toEqual([]);
    });
  });

  describe("POST /api/blueprints", () => {
    it("saves a blueprint", async () => {
      const res = await SELF.fetch("http://localhost/api/blueprints", {
        method: "POST",
        headers: {
          ...(await authHeaders(sessionToken)),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          craftingBlueprintId,
          nickname: "My Rifle",
          qualityConfig: { "0": 750, "1": 500 },
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean };
      expect(body.ok).toBe(true);
    });

    it("saved blueprint appears in list", async () => {
      // Re-save to ensure data exists (tests may not share state)
      await SELF.fetch("http://localhost/api/blueprints", {
        method: "POST",
        headers: {
          ...(await authHeaders(sessionToken)),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          craftingBlueprintId,
          nickname: "My Rifle",
          qualityConfig: { "0": 750, "1": 500 },
        }),
      });

      const res = await SELF.fetch("http://localhost/api/blueprints", {
        headers: await authHeaders(sessionToken),
      });
      const body = (await res.json()) as {
        items: {
          id: number;
          nickname: string;
          crafted_quantity: number;
          quality_config: Record<string, number>;
          blueprint_name: string;
        }[];
      };
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      const item = body.items.find((i: { nickname: string }) => i.nickname === "My Rifle");
      expect(item).toBeTruthy();
      expect(item!.crafted_quantity).toBe(0);
      expect(item!.quality_config).toEqual({ "0": 750, "1": 500 });
      expect(item!.blueprint_name).toBe("Test Blueprint");
    });

    it("upserts on duplicate (same blueprint)", async () => {
      const res = await SELF.fetch("http://localhost/api/blueprints", {
        method: "POST",
        headers: {
          ...(await authHeaders(sessionToken)),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          craftingBlueprintId,
          nickname: "Updated Rifle",
        }),
      });
      expect(res.status).toBe(200);

      const list = await SELF.fetch("http://localhost/api/blueprints", {
        headers: await authHeaders(sessionToken),
      });
      const body = (await list.json()) as { items: { nickname: string }[] };
      expect(body.items).toHaveLength(1);
      expect(body.items[0].nickname).toBe("Updated Rifle");
    });
  });

  describe("PATCH /api/blueprints/:id", () => {
    it("updates crafted quantity", async () => {
      // Ensure a blueprint exists (re-save)
      await SELF.fetch("http://localhost/api/blueprints", {
        method: "POST",
        headers: {
          ...(await authHeaders(sessionToken)),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ craftingBlueprintId }),
      });
      const row = await env.DB.prepare(
        "SELECT id FROM user_blueprints WHERE user_id = ? LIMIT 1"
      ).bind(userId).first<{ id: number }>();
      expect(row).toBeTruthy();
      const id = row!.id;

      const res = await SELF.fetch(`http://localhost/api/blueprints/${id}`, {
        method: "PATCH",
        headers: {
          ...(await authHeaders(sessionToken)),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ craftedQuantity: 3 }),
      });
      expect(res.status).toBe(200);

      // Verify via API
      const verifyRes = await SELF.fetch("http://localhost/api/blueprints", {
        headers: await authHeaders(sessionToken),
      });
      const verify = (await verifyRes.json()) as {
        items: { crafted_quantity: number }[];
      };
      expect(verify.items[0].crafted_quantity).toBe(3);
    });

    it("returns 404 for another user's blueprint", async () => {
      const other = await createTestUser(env.DB);
      // Ensure a blueprint exists
      await SELF.fetch("http://localhost/api/blueprints", {
        method: "POST",
        headers: {
          ...(await authHeaders(sessionToken)),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ craftingBlueprintId }),
      });
      const row = await env.DB.prepare(
        "SELECT id FROM user_blueprints WHERE user_id = ? LIMIT 1"
      ).bind(userId).first<{ id: number }>();
      const id = row!.id;

      const res = await SELF.fetch(`http://localhost/api/blueprints/${id}`, {
        method: "PATCH",
        headers: {
          ...(await authHeaders(other.sessionToken)),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ craftedQuantity: 999 }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/blueprints/:id", () => {
    it("removes a saved blueprint", async () => {
      // Ensure a blueprint exists
      await SELF.fetch("http://localhost/api/blueprints", {
        method: "POST",
        headers: {
          ...(await authHeaders(sessionToken)),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ craftingBlueprintId }),
      });
      const row = await env.DB.prepare(
        "SELECT id FROM user_blueprints WHERE user_id = ? LIMIT 1"
      ).bind(userId).first<{ id: number }>();
      expect(row).toBeTruthy();
      const id = row!.id;

      const res = await SELF.fetch(`http://localhost/api/blueprints/${id}`, {
        method: "DELETE",
        headers: {
          ...(await authHeaders(sessionToken)),
          "Content-Length": "0",
        },
      });
      expect(res.status).toBe(200);

      const verifyRes = await SELF.fetch("http://localhost/api/blueprints", {
        headers: await authHeaders(sessionToken),
      });
      const verify = (await verifyRes.json()) as { items: unknown[] };
      expect(verify.items).toHaveLength(0);
    });
  });
});
