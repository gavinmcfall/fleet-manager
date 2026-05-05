import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { setupTestDatabase } from "./apply-migrations";

async function seed() {
  const db = env.DB as D1Database;
  // Clean
  await db.batch([
    db.prepare("DELETE FROM crafting_slot_modifiers"),
    db.prepare("DELETE FROM crafting_blueprint_slots"),
    db.prepare("DELETE FROM crafting_blueprints WHERE uuid IN ('api-bp-resource', 'api-bp-item')"),
  ]);
  await db.prepare(
    `INSERT INTO crafting_blueprints (uuid, tag, name, type, sub_type, craft_time_seconds)
     VALUES ('api-bp-resource', 'BP_CRAFT_API_R', 'API Resource Test', 'weapons', 'rifle', 60),
            ('api-bp-item', 'BP_CRAFT_API_I', 'API Item Test', 'weapons', 'sniper', 60)`
  ).run();
  const bps = await db.prepare(
    "SELECT id, uuid FROM crafting_blueprints WHERE uuid IN ('api-bp-resource', 'api-bp-item')"
  ).all<{ id: number; uuid: string }>();
  const resBp = bps.results.find(b => b.uuid === "api-bp-resource")!;
  const itemBp = bps.results.find(b => b.uuid === "api-bp-item")!;

  await db.prepare(
    `INSERT INTO crafting_blueprint_slots (crafting_blueprint_id, slot_index, name, slot_name, resource_name, quantity, min_quality, slot_type, item_class)
     VALUES (?, 0, 'Frame', 'Frame', 'Iron', 1, 0, 'resource', NULL)`
  ).bind(resBp.id).run();
  await db.prepare(
    `INSERT INTO crafting_blueprint_slots (crafting_blueprint_id, slot_index, name, slot_name, resource_name, quantity, min_quality, slot_type, item_class)
     VALUES (?, 0, 'Precision Parts', 'Precision Parts', 'Hadanite', 1, 0, 'item', 'harvestable_mineral_1h_hadanite')`
  ).bind(itemBp.id).run();
}

describe("crafting API — slot_type and item_class fields", () => {
  beforeAll(async () => { await setupTestDatabase(env.DB); });
  beforeEach(async () => { await seed(); });

  it("returns slot_type='resource' and item_class=null for resource slots", async () => {
    const res = await SELF.fetch("https://x/api/gamedata/crafting");
    const body = await res.json() as { blueprints: Array<{ uuid: string; slots: Array<Record<string, unknown>> }> };
    const bp = body.blueprints.find(b => b.uuid === "api-bp-resource")!;
    expect(bp.slots).toHaveLength(1);
    expect(bp.slots[0].slot_type).toBe("resource");
    expect(bp.slots[0].item_class).toBeNull();
    expect(bp.slots[0].resource_name).toBe("Iron");
  });

  it("returns slot_type='item' and item_class set for item slots", async () => {
    const res = await SELF.fetch("https://x/api/gamedata/crafting");
    const body = await res.json() as { blueprints: Array<{ uuid: string; slots: Array<Record<string, unknown>> }> };
    const bp = body.blueprints.find(b => b.uuid === "api-bp-item")!;
    expect(bp.slots).toHaveLength(1);
    expect(bp.slots[0].slot_type).toBe("item");
    expect(bp.slots[0].item_class).toBe("harvestable_mineral_1h_hadanite");
    expect(bp.slots[0].resource_name).toBe("Hadanite");
  });
});
