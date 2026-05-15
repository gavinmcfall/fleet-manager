import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { setupTestDatabase } from "./apply-migrations";
import { createTestUser, authHeaders } from "./helpers";

/**
 * Add Concept Ship — admin can create pledgeable ships that aren't in
 * DataCore yet (Aegis Odin pattern). Class name stays NULL; the nightly
 * RSI sync enriches metadata when CIG adds the ship to the Ship Matrix.
 */
describe("Admin Add Concept Ship", () => {
  let adminToken: string;
  let manufacturerId: number;

  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    const admin = await createTestUser(env.DB, { role: "super_admin" });
    adminToken = admin.sessionToken;

    // Ensure a manufacturer row exists for the dropdown + insert path.
    const mfr = await env.DB.prepare(
      `INSERT INTO manufacturers (uuid, name, slug, code, game_version_id)
       VALUES ('mfr-uuid-aeg', 'Aegis Dynamics', 'aegs', 'AEG', 1)
       ON CONFLICT(uuid) DO UPDATE SET slug=excluded.slug, code=excluded.code
       RETURNING id`,
    ).first<{ id: number }>();
    manufacturerId = mfr!.id;
  });

  describe("GET /api/admin/manufacturers", () => {
    it("requires admin session", async () => {
      const res = await SELF.fetch("https://example.com/api/admin/manufacturers");
      expect([401, 403]).toContain(res.status);
    });

    it("returns active manufacturers with code + slug", async () => {
      const res = await SELF.fetch("https://example.com/api/admin/manufacturers", {
        headers: await authHeaders(adminToken),
      });
      expect(res.status).toBe(200);
      const list = await res.json() as Array<{ id: number; name: string; code: string; slug: string }>;
      expect(Array.isArray(list)).toBe(true);
      const aeg = list.find(m => m.code === "AEG");
      expect(aeg).toBeDefined();
      expect(aeg?.slug).toBe("aegs");
    });
  });

  describe("POST /api/admin/vehicles/concept", () => {
    it("creates a row with class_name=NULL, is_pledgeable=1, auto-derived slug", async () => {
      const res = await SELF.fetch("https://example.com/api/admin/vehicles/concept", {
        method: "POST",
        headers: { ...(await authHeaders(adminToken)), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Aegis Odin",
          manufacturer_id: manufacturerId,
          focus: "Combat",
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as { ok: boolean; vehicle: { slug: string; name: string } };
      expect(body.vehicle.slug).toBe("aegs-odin");
      expect(body.vehicle.name).toBe("Aegis Odin");

      // Confirm DB shape — class_name NULL, is_pledgeable 1, is_npc_only 0
      const row = await env.DB
        .prepare("SELECT class_name, is_pledgeable, is_npc_only, focus FROM vehicles WHERE slug = ?")
        .bind("aegs-odin")
        .first<{ class_name: string | null; is_pledgeable: number; is_npc_only: number; focus: string }>();
      expect(row?.class_name).toBeNull();
      expect(row?.is_pledgeable).toBe(1);
      expect(row?.is_npc_only).toBe(0);
      expect(row?.focus).toBe("Combat");
    });

    it("honors explicit slug override", async () => {
      const res = await SELF.fetch("https://example.com/api/admin/vehicles/concept", {
        method: "POST",
        headers: { ...(await authHeaders(adminToken)), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Aegis Custom Name",
          slug: "aegs-explicit-override",
          manufacturer_id: manufacturerId,
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as { vehicle: { slug: string } };
      expect(body.vehicle.slug).toBe("aegs-explicit-override");
    });

    it("rejects duplicate slug with 409", async () => {
      // Set up: first insert with a unique name so other tests don't collide
      const headers = { ...(await authHeaders(adminToken)), "Content-Type": "application/json" };
      const setup = await SELF.fetch("https://example.com/api/admin/vehicles/concept", {
        method: "POST", headers,
        body: JSON.stringify({ name: "Aegis Duplicate Probe", manufacturer_id: manufacturerId }),
      });
      expect(setup.status).toBe(201);

      // Same name → same auto-derived slug → conflict
      const res = await SELF.fetch("https://example.com/api/admin/vehicles/concept", {
        method: "POST", headers,
        body: JSON.stringify({ name: "Aegis Duplicate Probe", manufacturer_id: manufacturerId }),
      });
      expect(res.status).toBe(409);
      const err = await res.json() as { error: string };
      expect(err.error).toContain("Slug already exists");
    });

    it("rejects unknown manufacturer with 404", async () => {
      const res = await SELF.fetch("https://example.com/api/admin/vehicles/concept", {
        method: "POST",
        headers: { ...(await authHeaders(adminToken)), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Phantom Ship",
          manufacturer_id: 999999,
        }),
      });
      expect(res.status).toBe(404);
    });

    it("rejects missing name with 400", async () => {
      const res = await SELF.fetch("https://example.com/api/admin/vehicles/concept", {
        method: "POST",
        headers: { ...(await authHeaders(adminToken)), "Content-Type": "application/json" },
        body: JSON.stringify({
          manufacturer_id: manufacturerId,
        }),
      });
      expect(res.status).toBe(400);
    });

    it("requires admin session", async () => {
      const res = await SELF.fetch("https://example.com/api/admin/vehicles/concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "X", manufacturer_id: manufacturerId }),
      });
      expect([401, 403]).toContain(res.status);
    });
  });
});
