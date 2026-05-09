import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { setupTestDatabase } from "./apply-migrations";
import { createTestUser, authHeaders, seedLootItem } from "./helpers";

describe("Loot Crafted Counter — GET /api/loot/crafted", () => {
  let sessionToken: string;
  let userId: string;

  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    const user = await createTestUser(env.DB);
    sessionToken = user.sessionToken;
    userId = user.userId;
  });

  it("requires authentication", async () => {
    const res = await SELF.fetch("http://localhost/api/loot/crafted");
    expect(res.status).toBe(401);
  });

  it("returns empty object when user has no crafted blueprints", async () => {
    const res = await SELF.fetch("http://localhost/api/loot/crafted", {
      headers: await authHeaders(sessionToken),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, number>;
    expect(body).toEqual({});
  });

  it("sums parent + builds crafted_quantity per loot uuid", async () => {
    // Seed a loot item with a known class_name
    const { uuid: lootUuid } = await seedLootItem(env.DB, {
      name: "Crafted Counter Rifle",
      type: "Weapon",
    });
    await env.DB.prepare(
      "UPDATE loot_map SET class_name = ? WHERE uuid = ?",
    )
      .bind("ccrafted_rifle_01", lootUuid)
      .run();

    // Seed a LIVE crafting blueprint whose output is that class_name
    const bpUuid = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO crafting_blueprints (uuid, tag, name, type, sub_type, output_item, craft_time_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(bpUuid, "BP_CC", "CC Rifle BP", "weapons", "rifle", "ccrafted_rifle_01", 120)
      .run();

    // Parent counter: 2 crafted on user_blueprints
    await env.DB.prepare(
      `INSERT INTO user_blueprints (user_id, blueprint_uuid, is_owned, crafted_quantity)
       VALUES (?, ?, 1, 2)`,
    )
      .bind(userId, bpUuid)
      .run();

    // Two named builds with their own counters: 3 + 4 = 7
    await env.DB.prepare(
      `INSERT INTO user_blueprint_builds
        (user_id, blueprint_uuid, name, quality_config_json, crafted_quantity)
       VALUES (?, ?, 'Build A', '{}', 3), (?, ?, 'Build B', '{}', 4)`,
    )
      .bind(userId, bpUuid, userId, bpUuid)
      .run();

    const res = await SELF.fetch("http://localhost/api/loot/crafted", {
      headers: await authHeaders(sessionToken),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, number>;
    expect(body[lootUuid]).toBe(2 + 3 + 4);
  });

  it("sums across PTU blueprints + ptu_loot_map", async () => {
    // Seed a PTU loot item
    const ptuUuid = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO ptu_loot_map (uuid, name, class_name, type, game_version_id)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(ptuUuid, "PTU Counter Pistol", "ccrafted_ptu_pistol_01", "Weapon", 1)
      .run();

    // PTU crafting blueprint
    const bpUuid = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO ptu_crafting_blueprints (uuid, tag, name, type, sub_type, output_item, craft_time_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(bpUuid, "BP_PTU_CC", "PTU CC BP", "weapons", "pistol", "ccrafted_ptu_pistol_01", 60)
      .run();

    // Parent + one build
    await env.DB.prepare(
      `INSERT INTO user_blueprints (user_id, blueprint_uuid, is_owned, crafted_quantity)
       VALUES (?, ?, 1, 1)`,
    )
      .bind(userId, bpUuid)
      .run();
    await env.DB.prepare(
      `INSERT INTO user_blueprint_builds
        (user_id, blueprint_uuid, name, quality_config_json, crafted_quantity)
       VALUES (?, ?, 'PTU Build', '{}', 5)`,
    )
      .bind(userId, bpUuid)
      .run();

    const res = await SELF.fetch("http://localhost/api/loot/crafted", {
      headers: await authHeaders(sessionToken),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, number>;
    expect(body[ptuUuid]).toBe(1 + 5);
  });

  it("excludes other users' crafted counts", async () => {
    const otherUser = await createTestUser(env.DB);
    const { uuid: lootUuid } = await seedLootItem(env.DB, {
      name: "Other User Item",
      type: "Weapon",
    });
    await env.DB.prepare("UPDATE loot_map SET class_name = ? WHERE uuid = ?")
      .bind("other_user_class_01", lootUuid)
      .run();

    const bpUuid = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO crafting_blueprints (uuid, tag, name, type, sub_type, output_item, craft_time_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(bpUuid, "BP_OTHER", "Other BP", "weapons", "other", "other_user_class_01", 120)
      .run();
    await env.DB.prepare(
      `INSERT INTO user_blueprints (user_id, blueprint_uuid, is_owned, crafted_quantity)
       VALUES (?, ?, 1, 99)`,
    )
      .bind(otherUser.userId, bpUuid)
      .run();

    const res = await SELF.fetch("http://localhost/api/loot/crafted", {
      headers: await authHeaders(sessionToken),
    });
    const body = (await res.json()) as Record<string, number>;
    expect(body[lootUuid]).toBeUndefined();
  });
});
