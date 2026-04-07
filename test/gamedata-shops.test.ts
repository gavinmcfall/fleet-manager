import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { setupTestDatabase, TEST_GAME_VERSION_ID } from "./apply-migrations";
import { createTestUser, authHeaders } from "./helpers";

async function seedShopData(db: D1Database) {
  // Insert a non-commodity shop with gear items
  await db.batch([
    db.prepare(
      `INSERT INTO shops (uuid, name, slug, shop_type, is_event, location_label, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind("wep-shop-1", "CenterMass_Area18", "centermass-area18", "weapons", 0, "Area18", TEST_GAME_VERSION_ID),
    db.prepare(
      `INSERT INTO shops (uuid, name, slug, shop_type, is_event, location_label, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind("arm-shop-1", "Casaba_NewBabbage", "casaba-newbabbage", "clothing", 0, "New Babbage", TEST_GAME_VERSION_ID),
  ]);

  const shops = await db.prepare("SELECT id, slug FROM shops ORDER BY id").all();
  const shopWeapons = shops.results[0].id as number;
  const shopClothing = shops.results[1].id as number;

  // Insert terminals
  await db.batch([
    db.prepare(
      `INSERT INTO terminals (uuid, shop_id, shop_name_key, terminal_type, game_version_id)
       VALUES (?, ?, ?, ?, ?)`
    ).bind("wep-term-1", shopWeapons, "SCShop_CenterMass_Area18", "item", TEST_GAME_VERSION_ID),
    db.prepare(
      `INSERT INTO terminals (uuid, shop_id, shop_name_key, terminal_type, game_version_id)
       VALUES (?, ?, ?, ?, ?)`
    ).bind("arm-term-1", shopClothing, "SCShop_Casaba_NewBabbage", "item", TEST_GAME_VERSION_ID),
  ]);

  const terminals = await db.prepare("SELECT id, uuid FROM terminals ORDER BY id").all();
  const termWeapons = terminals.results[0].id as number;
  const termClothing = terminals.results[1].id as number;

  // Insert terminal_inventory
  await db.batch([
    db.prepare(
      `INSERT INTO terminal_inventory (terminal_id, item_uuid, item_name, base_buy_price, base_sell_price, base_inventory, max_inventory, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(termWeapons, "item-1111", "P4-AR Ballistic Rifle", 5600, 0, 10, 50, TEST_GAME_VERSION_ID),
    db.prepare(
      `INSERT INTO terminal_inventory (terminal_id, item_uuid, item_name, base_buy_price, base_sell_price, base_inventory, max_inventory, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(termWeapons, "item-2222", "FS-9 LMG", 8200, 0, 5, 20, TEST_GAME_VERSION_ID),
    db.prepare(
      `INSERT INTO terminal_inventory (terminal_id, item_uuid, item_name, base_buy_price, base_sell_price, base_inventory, max_inventory, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(termClothing, "item-3333", "Odyssey II Flight Suit", 1200, 300, 20, 100, TEST_GAME_VERSION_ID),
  ]);
}

describe("GET /api/gamedata/shops", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    await seedShopData(env.DB);
  });

  it("returns 200 with shop list including item counts", async () => {
    const { sessionToken } = await createTestUser(env.DB);
    const res = await SELF.fetch("http://localhost/api/gamedata/shops", {
      headers: await authHeaders(sessionToken),
    });
    expect(res.status).toBe(200);

    const shops = (await res.json()) as any[];
    expect(shops.length).toBe(2);

    const weapons = shops.find((s: any) => s.slug === "centermass-area18");
    expect(weapons).toBeDefined();
    expect(weapons.item_count).toBe(2);
    expect(weapons.shop_type).toBe("weapons");

    const clothing = shops.find((s: any) => s.slug === "casaba-newbabbage");
    expect(clothing).toBeDefined();
    expect(clothing.item_count).toBe(1);
  });
});

describe("GET /api/gamedata/shops/:slug/inventory", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    await seedShopData(env.DB);
  });

  it("returns inventory items with resolved names and prices", async () => {
    const { sessionToken } = await createTestUser(env.DB);
    const res = await SELF.fetch(
      "http://localhost/api/gamedata/shops/centermass-area18/inventory",
      { headers: await authHeaders(sessionToken) }
    );
    expect(res.status).toBe(200);

    const items = (await res.json()) as any[];
    expect(items.length).toBe(2);

    const rifle = items.find((i: any) => i.item_uuid === "item-1111");
    expect(rifle).toBeDefined();
    expect(rifle.buy_price).toBe(5600);
    expect(rifle.resolved_name).toBe("P4-AR Ballistic Rifle");
  });

  it("returns 404 for unknown slug", async () => {
    const { sessionToken } = await createTestUser(env.DB);
    const res = await SELF.fetch(
      "http://localhost/api/gamedata/shops/nonexistent/inventory",
      { headers: await authHeaders(sessionToken) }
    );
    expect(res.status).toBe(404);
  });
});
