import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { setupTestDatabase } from "./apply-migrations";

/**
 * PART L L7 — /api/ships/:slug returns a `storage` array alongside the vehicle.
 * Detail rows come from vehicle_storage (one row per discrete storage feature).
 * Summary cols (internal_cargo_scu, external_cargo_scu, fuel_cargo_scu,
 * personal_grid_microscu, locker_count) are denormalized from those rows.
 */
describe("GET /api/ships/:slug — storage detail", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    await env.DB.prepare(
      `INSERT OR IGNORE INTO manufacturers (uuid, name, slug, code, game_version_id)
       VALUES ('mfr-uuid-misc', 'Musashi Industrial', 'misc', 'MISC', 1)`,
    ).run();
    const mfr = await env.DB.prepare(
      `SELECT id FROM manufacturers WHERE uuid = 'mfr-uuid-misc'`,
    ).first<{ id: number }>();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO vehicles
         (uuid, slug, name, class_name, manufacturer_id, game_version_id,
          is_pledgeable, is_npc_only, is_paint_variant, removed,
          cargo, internal_cargo_scu, external_cargo_scu)
       VALUES
         ('veh-test-hullb', 'misc-hull-b-test', 'MISC Hull B Test', 'misc_hull_b_test',
          ?, 1, 1, 0, 0, 0, 32, 32, 512)`,
    ).bind(mfr!.id).run();
    const veh = await env.DB.prepare(
      `SELECT id FROM vehicles WHERE uuid = 'veh-test-hullb'`,
    ).first<{ id: number }>();
    await env.DB.prepare(
      `INSERT INTO vehicle_storage
         (vehicle_id, storage_type, container_class_name, scu_capacity, count, location_label, game_version_id)
       VALUES
         (?, 'internal_grid', 'MISC_Hull_B_Interior', 32, 1, 'interior bay', 1),
         (?, 'external_pod', 'MISC_Hull_B_CargoGrid', 32, 16, 'external pods', 1),
         (?, 'suit_locker', NULL, NULL, 2, 'crew area', 1)`,
    ).bind(veh!.id, veh!.id, veh!.id).run();
  });

  it("returns vehicle with summary cols + storage detail array", async () => {
    const res = await SELF.fetch("https://example.com/api/ships/misc-hull-b-test");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.slug).toBe("misc-hull-b-test");
    expect(body.cargo).toBe(32);
    expect(body.internal_cargo_scu).toBe(32);
    expect(body.external_cargo_scu).toBe(512);

    const storage = body.storage as Array<{
      storage_type: string;
      scu_capacity: number | null;
      count: number;
      location_label: string | null;
    }>;
    expect(storage).toHaveLength(3);
    expect(storage[0].storage_type).toBe("internal_grid");
    expect(storage[1].storage_type).toBe("external_pod");
    expect(storage[1].scu_capacity).toBe(32);
    expect(storage[1].count).toBe(16);
    expect(storage[2].storage_type).toBe("suit_locker");
  });

  it("filters out soft-deleted storage rows", async () => {
    const veh = await env.DB.prepare(
      `SELECT id FROM vehicles WHERE uuid = 'veh-test-hullb'`,
    ).first<{ id: number }>();
    await env.DB.prepare(
      `INSERT INTO vehicle_storage
         (vehicle_id, storage_type, scu_capacity, count, game_version_id, is_deleted)
       VALUES (?, 'fuel_cargo', 999, 1, 1, 1)`,
    ).bind(veh!.id).run();

    const res = await SELF.fetch("https://example.com/api/ships/misc-hull-b-test");
    const body = (await res.json()) as { storage: Array<{ storage_type: string }> };
    expect(body.storage.find(s => s.storage_type === "fuel_cargo")).toBeUndefined();
  });
});
