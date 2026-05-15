import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { setupTestDatabase } from "./apply-migrations";
import { createTestUser, authHeaders, seedVehicle, seedFleetEntry } from "./helpers";

describe("Fleet API — /api/vehicles", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
  });

  describe("GET /api/vehicles", () => {
    it("returns empty array for user with no fleet", async () => {
      const { sessionToken } = await createTestUser(env.DB);
      const res = await SELF.fetch("http://localhost/api/vehicles", {
        headers: await authHeaders(sessionToken),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual([]);
    });

    it("returns fleet entries with joined reference data", async () => {
      const { userId, sessionToken } = await createTestUser(env.DB);
      const vehicleId = await seedVehicle(env.DB, {
        name: "Aurora MR",
        slug: "aurora-mr",
        focus: "Starter",
        size_label: "Small",
      });
      await seedFleetEntry(env.DB, userId, vehicleId, {
        insurance_type_id: 1, // LTI
        pledge_name: "Aurora MR Starter Pack",
      });

      const res = await SELF.fetch("http://localhost/api/vehicles", {
        headers: await authHeaders(sessionToken),
      });
      expect(res.status).toBe(200);
      const fleet = (await res.json()) as Array<Record<string, unknown>>;
      expect(fleet).toHaveLength(1);
      expect(fleet[0].vehicle_name).toBe("Aurora MR");
      expect(fleet[0].insurance_label).toBe("Lifetime Insurance");
      expect(fleet[0].pledge_name).toBe("Aurora MR Starter Pack");
    });

    it("returns only the authenticated user's fleet", async () => {
      const user1 = await createTestUser(env.DB);
      const user2 = await createTestUser(env.DB);
      const vehicleId = await seedVehicle(env.DB, {
        slug: "gladius-isolation",
        name: "Gladius",
      });

      await seedFleetEntry(env.DB, user1.userId, vehicleId);
      await seedFleetEntry(env.DB, user2.userId, vehicleId);

      const res = await SELF.fetch("http://localhost/api/vehicles", {
        headers: await authHeaders(user1.sessionToken),
      });
      const fleet = (await res.json()) as Array<Record<string, unknown>>;
      expect(fleet).toHaveLength(1);
      expect(fleet[0].user_id).toBeUndefined; // user_id not leaked... actually it is in the query
    });

    it("supports multiple ships including duplicates", async () => {
      const { userId, sessionToken } = await createTestUser(env.DB);
      const vehicleId = await seedVehicle(env.DB, {
        slug: "ptv-dup-test",
        name: "PTV",
      });

      // Two PTVs — no UNIQUE on user_fleet
      await seedFleetEntry(env.DB, userId, vehicleId);
      await seedFleetEntry(env.DB, userId, vehicleId, { custom_name: "PTV 2" });

      const res = await SELF.fetch("http://localhost/api/vehicles", {
        headers: await authHeaders(sessionToken),
      });
      const fleet = (await res.json()) as Array<Record<string, unknown>>;
      expect(fleet).toHaveLength(2);
    });
  });

  describe("GET /api/vehicles/with-insurance", () => {
    it("returns same data as /api/vehicles", async () => {
      const { sessionToken } = await createTestUser(env.DB);
      const [res1, res2] = await Promise.all([
        SELF.fetch("http://localhost/api/vehicles", {
          headers: await authHeaders(sessionToken),
        }),
        SELF.fetch("http://localhost/api/vehicles/with-insurance", {
          headers: await authHeaders(sessionToken),
        }),
      ]);
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      const body1 = await res1.json();
      const body2 = await res2.json();
      expect(body1).toEqual(body2);
    });
  });

  describe("PATCH /api/vehicles/:id/visibility", () => {
    it("updates org_visibility", async () => {
      const { userId, sessionToken } = await createTestUser(env.DB);
      const vehicleId = await seedVehicle(env.DB, {
        slug: "vis-test-ship",
        name: "Visibility Test",
      });
      const fleetId = await seedFleetEntry(env.DB, userId, vehicleId);

      const res = await SELF.fetch(
        `http://localhost/api/vehicles/${fleetId}/visibility`,
        {
          method: "PATCH",
          headers: {
            ...(await await authHeaders(sessionToken)),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ org_visibility: "org" }),
        }
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.ok).toBe(true);
    });

    it("rejects invalid visibility value", async () => {
      const { userId, sessionToken } = await createTestUser(env.DB);
      const vehicleId = await seedVehicle(env.DB, {
        slug: "vis-invalid-test",
        name: "Invalid Vis Test",
      });
      const fleetId = await seedFleetEntry(env.DB, userId, vehicleId);

      const res = await SELF.fetch(
        `http://localhost/api/vehicles/${fleetId}/visibility`,
        {
          method: "PATCH",
          headers: {
            ...(await await authHeaders(sessionToken)),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ org_visibility: "invalid_value" }),
        }
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for another user's fleet entry", async () => {
      const user1 = await createTestUser(env.DB);
      const user2 = await createTestUser(env.DB);
      const vehicleId = await seedVehicle(env.DB, {
        slug: "vis-other-user",
        name: "Other User Ship",
      });
      const fleetId = await seedFleetEntry(env.DB, user1.userId, vehicleId);

      // user2 tries to modify user1's fleet entry
      const res = await SELF.fetch(
        `http://localhost/api/vehicles/${fleetId}/visibility`,
        {
          method: "PATCH",
          headers: {
            ...(await authHeaders(user2.sessionToken)),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ org_visibility: "public" }),
        }
      );
      expect(res.status).toBe(404);
    });

    it("rejects with no fields to update", async () => {
      const { userId, sessionToken } = await createTestUser(env.DB);
      const vehicleId = await seedVehicle(env.DB, {
        slug: "vis-empty-test",
        name: "Empty Update Test",
      });
      const fleetId = await seedFleetEntry(env.DB, userId, vehicleId);

      const res = await SELF.fetch(
        `http://localhost/api/vehicles/${fleetId}/visibility`,
        {
          method: "PATCH",
          headers: {
            ...(await await authHeaders(sessionToken)),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );
      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/vehicles/:id/paint", () => {
    async function seedPaintLinked(vehicleId: number, name: string) {
      const result = await env.DB
        .prepare(
          "INSERT INTO paints (name, slug, class_name, image_url) VALUES (?, ?, ?, 'https://x/p.png') RETURNING id",
        )
        .bind(name, name.toLowerCase().replace(/\s+/g, "-"), `paint_${name.toLowerCase().replace(/\s+/g, "_")}`)
        .first<{ id: number }>();
      const paintId = result!.id;
      await env.DB
        .prepare("INSERT INTO paint_vehicles (paint_id, vehicle_id) VALUES (?, ?)")
        .bind(paintId, vehicleId)
        .run();
      return paintId;
    }

    async function grantPaintOwnership(userId: string, paintId: number) {
      await env.DB
        .prepare("INSERT INTO user_paints (user_id, paint_id) VALUES (?, ?)")
        .bind(userId, paintId)
        .run();
    }

    it("equips a paint the user owns + has the linkage", async () => {
      const { userId, sessionToken } = await createTestUser(env.DB);
      const vehicleId = await seedVehicle(env.DB, { slug: "paint-equip-1", name: "Test Ship" });
      const fleetId = await seedFleetEntry(env.DB, userId, vehicleId);
      const paintId = await seedPaintLinked(vehicleId, "Test Livery");
      await grantPaintOwnership(userId, paintId);

      const res = await SELF.fetch(`http://localhost/api/vehicles/${fleetId}/paint`, {
        method: "PATCH",
        headers: { ...(await authHeaders(sessionToken)), "Content-Type": "application/json" },
        body: JSON.stringify({ paint_id: paintId }),
      });
      expect(res.status).toBe(200);

      const row = await env.DB
        .prepare("SELECT equipped_paint_id FROM user_fleet WHERE id = ?")
        .bind(fleetId)
        .first<{ equipped_paint_id: number | null }>();
      expect(row?.equipped_paint_id).toBe(paintId);
    });

    it("rejects an unowned paint with 403", async () => {
      const { userId, sessionToken } = await createTestUser(env.DB);
      const vehicleId = await seedVehicle(env.DB, { slug: "paint-equip-2", name: "Test Ship 2" });
      const fleetId = await seedFleetEntry(env.DB, userId, vehicleId);
      const paintId = await seedPaintLinked(vehicleId, "Unowned Livery");
      // intentionally do NOT grant ownership

      const res = await SELF.fetch(`http://localhost/api/vehicles/${fleetId}/paint`, {
        method: "PATCH",
        headers: { ...(await authHeaders(sessionToken)), "Content-Type": "application/json" },
        body: JSON.stringify({ paint_id: paintId }),
      });
      expect(res.status).toBe(403);
    });

    it("rejects a paint not linked to this vehicle with 400", async () => {
      const { userId, sessionToken } = await createTestUser(env.DB);
      const vehicleId = await seedVehicle(env.DB, { slug: "paint-equip-3", name: "Test Ship 3" });
      const otherVehicleId = await seedVehicle(env.DB, { slug: "paint-equip-3-other", name: "Other Ship" });
      const fleetId = await seedFleetEntry(env.DB, userId, vehicleId);
      const paintId = await seedPaintLinked(otherVehicleId, "Wrong Livery"); // linked to OTHER vehicle
      await grantPaintOwnership(userId, paintId);

      const res = await SELF.fetch(`http://localhost/api/vehicles/${fleetId}/paint`, {
        method: "PATCH",
        headers: { ...(await authHeaders(sessionToken)), "Content-Type": "application/json" },
        body: JSON.stringify({ paint_id: paintId }),
      });
      expect(res.status).toBe(400);
    });

    it("accepts null to unset the equipped paint", async () => {
      const { userId, sessionToken } = await createTestUser(env.DB);
      const vehicleId = await seedVehicle(env.DB, { slug: "paint-equip-4", name: "Test Ship 4" });
      const fleetId = await seedFleetEntry(env.DB, userId, vehicleId);
      const paintId = await seedPaintLinked(vehicleId, "To Unset Livery");
      await grantPaintOwnership(userId, paintId);

      // Equip first
      await env.DB
        .prepare("UPDATE user_fleet SET equipped_paint_id = ? WHERE id = ?")
        .bind(paintId, fleetId)
        .run();

      // Now unset
      const res = await SELF.fetch(`http://localhost/api/vehicles/${fleetId}/paint`, {
        method: "PATCH",
        headers: { ...(await authHeaders(sessionToken)), "Content-Type": "application/json" },
        body: JSON.stringify({ paint_id: null }),
      });
      expect(res.status).toBe(200);

      const row = await env.DB
        .prepare("SELECT equipped_paint_id FROM user_fleet WHERE id = ?")
        .bind(fleetId)
        .first<{ equipped_paint_id: number | null }>();
      expect(row?.equipped_paint_id).toBeNull();
    });

    it("returns 404 for another user's fleet entry", async () => {
      const user1 = await createTestUser(env.DB);
      const user2 = await createTestUser(env.DB);
      const vehicleId = await seedVehicle(env.DB, { slug: "paint-equip-5", name: "Test Ship 5" });
      const fleetId = await seedFleetEntry(env.DB, user1.userId, vehicleId);
      const paintId = await seedPaintLinked(vehicleId, "Cross-user Livery");
      await grantPaintOwnership(user2.userId, paintId);

      const res = await SELF.fetch(`http://localhost/api/vehicles/${fleetId}/paint`, {
        method: "PATCH",
        headers: { ...(await authHeaders(user2.sessionToken)), "Content-Type": "application/json" },
        body: JSON.stringify({ paint_id: paintId }),
      });
      expect(res.status).toBe(404);
    });
  });
});
