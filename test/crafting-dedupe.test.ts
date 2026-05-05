import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { setupTestDatabase } from "./apply-migrations";

async function seed() {
  const db = env.DB as D1Database;
  // Clean slate for crafting tables
  await db.batch([
    db.prepare("DELETE FROM crafting_slot_modifiers"),
    db.prepare("DELETE FROM crafting_blueprint_slots"),
    db.prepare("DELETE FROM crafting_blueprints WHERE uuid = 'test-bp-uuid-1'"),
  ]);
  // One blueprint
  await db.prepare(
    `INSERT INTO crafting_blueprints (uuid, tag, name, type, sub_type, craft_time_seconds)
     VALUES ('test-bp-uuid-1', 'BP_CRAFT_TEST_RIFLE', 'Test Rifle', 'weapons', 'rifle', 60)`
  ).run();
  const bp = await db.prepare("SELECT id FROM crafting_blueprints WHERE uuid = 'test-bp-uuid-1'").first<{ id: number }>();
  // Three duplicate slot rows for the same (bp_id, slot_index = 0)
  // Column is 'name' per migration 0129 schema
  for (let i = 0; i < 3; i++) {
    await db.prepare(
      `INSERT INTO crafting_blueprint_slots (crafting_blueprint_id, slot_index, name, resource_name, quantity, min_quality)
       VALUES (?, 0, 'Barrel', 'Steel', 1, 0)`
    ).bind(bp!.id).run();
  }
  // Three duplicate modifier rows for each slot, for crafting_property_id=1 (weapon_recoil_handling — seeded by 0129)
  const slots = await db.prepare("SELECT id FROM crafting_blueprint_slots WHERE crafting_blueprint_id = ?").bind(bp!.id).all<{ id: number }>();
  for (const s of slots.results) {
    for (let i = 0; i < 3; i++) {
      await db.prepare(
        `INSERT INTO crafting_slot_modifiers (crafting_blueprint_slot_id, crafting_property_id, start_quality, end_quality, modifier_at_start, modifier_at_end)
         VALUES (?, 1, 0, 1000, 1.0, 1.5)`
      ).bind(s.id).run();
    }
  }
}

describe("crafting API dedupe", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
  });

  beforeEach(async () => { await seed(); });

  it("returns one slot per (blueprint_id, slot_index)", async () => {
    const res = await SELF.fetch("https://x/api/gamedata/crafting");
    expect(res.status).toBe(200);
    const body = await res.json() as { blueprints: Array<{ uuid: string; slots: Array<{ slot_index: number }> }> };
    const bp = body.blueprints.find(b => b.uuid === "test-bp-uuid-1");
    expect(bp).toBeDefined();
    expect(bp!.slots).toHaveLength(1);
    expect(bp!.slots[0].slot_index).toBe(0);
  });

  it("returns one modifier per (slot_id, property_key)", async () => {
    const res = await SELF.fetch("https://x/api/gamedata/crafting");
    const body = await res.json() as { blueprints: Array<{ uuid: string; slots: Array<{ modifiers: Array<{ key: string }> }> }> };
    const bp = body.blueprints.find(b => b.uuid === "test-bp-uuid-1");
    expect(bp!.slots[0].modifiers).toHaveLength(1);
    expect(bp!.slots[0].modifiers[0].key).toBe("weapon_recoil_handling");
  });
});
