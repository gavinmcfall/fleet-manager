import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { setupTestDatabase, TEST_GAME_VERSION_ID } from "./apply-migrations";
import { createTestUser, authHeaders } from "./helpers";

/**
 * Seed trade commodity data: commodities, shops, and shop_inventory linking them.
 */
async function seedTradeData(db: D1Database) {
  // Insert trade commodities
  await db.batch([
    db.prepare(
      `INSERT INTO trade_commodities (uuid, name, slug, class_name, category, type_name, subtype_name, is_raw, boxable, scu_per_unit, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      "aaaa-1111", "Agricium", "agricium", "Agricium", "metals",
      "Metal", "Agricium", 0, 1, 0.01, "A rare metal used in advanced electronics."
    ),
    db.prepare(
      `INSERT INTO trade_commodities (uuid, name, slug, class_name, category, type_name, subtype_name, is_raw, boxable, scu_per_unit, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      "bbbb-2222", "Hydrogen", "hydrogen", "Hydrogen", "gas",
      "Gas", "Hydrogen", 0, 0, 0.01, "A common element used for fuel."
    ),
    db.prepare(
      `INSERT INTO trade_commodities (uuid, name, slug, class_name, category, type_name, subtype_name, is_raw, boxable, scu_per_unit, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      "cccc-3333", "WiDoW", "widow", "WiDoW", "vice",
      "Vice", "WiDoW", 0, 1, 0.01, "A highly illegal narcotic."
    ),
  ]);

  // Insert shops (admin type = commodity trading terminals)
  await db.batch([
    db.prepare(
      `INSERT INTO shops (uuid, name, slug, shop_type, is_event, location_label, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind("shop-1", "Inv Admin Area18", "inv-admin-area18", "admin", 0, "Area18", TEST_GAME_VERSION_ID),
    db.prepare(
      `INSERT INTO shops (uuid, name, slug, shop_type, is_event, location_label, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind("shop-2", "Inv Admin NewBabbage", "inv-admin-newbabbage", "admin", 0, "New Babbage", TEST_GAME_VERSION_ID),
    db.prepare(
      `INSERT INTO shops (uuid, name, slug, shop_type, is_event, location_label, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind("shop-3", "Inv Admin GrimHEX", "inv-admin-grimhex", "admin", 0, "Grim HEX", TEST_GAME_VERSION_ID),
  ]);

  // Get shop IDs
  const shops = await db.prepare("SELECT id, slug FROM shops ORDER BY id").all();
  const shopArea18 = shops.results[0].id as number;
  const shopNewBabbage = shops.results[1].id as number;
  const shopGrimHEX = shops.results[2].id as number;

  // Insert shop_inventory linking commodities to shops with buy/sell prices
  await db.batch([
    // Agricium: sold at Area18 and New Babbage (different prices = dynamic pricing evidence)
    db.prepare(
      `INSERT INTO shop_inventory (shop_id, item_uuid, item_name, buy_price, sell_price, base_inventory, max_inventory, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ${TEST_GAME_VERSION_ID})`
    ).bind(shopArea18, "aaaa-1111", "Agricium", 0, 25.447, 17757.62, 500000),
    db.prepare(
      `INSERT INTO shop_inventory (shop_id, item_uuid, item_name, buy_price, sell_price, base_inventory, max_inventory, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ${TEST_GAME_VERSION_ID})`
    ).bind(shopNewBabbage, "aaaa-1111", "Agricium", 0, 25.342, 99483.86, 600000),

    // Hydrogen: buyable at Area18, sellable at Grim HEX
    db.prepare(
      `INSERT INTO shop_inventory (shop_id, item_uuid, item_name, buy_price, sell_price, base_inventory, max_inventory, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ${TEST_GAME_VERSION_ID})`
    ).bind(shopArea18, "bbbb-2222", "Hydrogen", 1.25, 0, 500000, 1000000),
    db.prepare(
      `INSERT INTO shop_inventory (shop_id, item_uuid, item_name, buy_price, sell_price, base_inventory, max_inventory, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ${TEST_GAME_VERSION_ID})`
    ).bind(shopGrimHEX, "bbbb-2222", "Hydrogen", 0, 1.18, 200000, 800000),

    // WiDoW: buyable at Grim HEX only (illegal)
    db.prepare(
      `INSERT INTO shop_inventory (shop_id, item_uuid, item_name, buy_price, sell_price, base_inventory, max_inventory, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ${TEST_GAME_VERSION_ID})`
    ).bind(shopGrimHEX, "cccc-3333", "WiDoW", 24.5, 0, 5000, 20000),
  ]);
}

describe("GET /api/gamedata/trade", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    await seedTradeData(env.DB);
  });

  it("returns 200 with commodities and locations", async () => {
    const { sessionToken } = await createTestUser(env.DB);
    const res = await SELF.fetch("http://localhost/api/gamedata/trade", {
      headers: await authHeaders(sessionToken),
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      commodities: any[];
      locations: string[];
    };
    expect(body).toHaveProperty("commodities");
    expect(body).toHaveProperty("locations");
    expect(body.commodities.length).toBe(3);
    expect(body.locations.length).toBe(3);
  });

  it("returns commodities sorted by category then name", async () => {
    const { sessionToken } = await createTestUser(env.DB);
    const res = await SELF.fetch("http://localhost/api/gamedata/trade", {
      headers: await authHeaders(sessionToken),
    });
    const body = (await res.json()) as { commodities: any[] };
    const names = body.commodities.map((c: any) => c.name);
    // gas < metals < vice (alphabetical by category)
    expect(names).toEqual(["Hydrogen", "Agricium", "WiDoW"]);
  });

  it("nests shop listings under each commodity", async () => {
    const { sessionToken } = await createTestUser(env.DB);
    const res = await SELF.fetch("http://localhost/api/gamedata/trade", {
      headers: await authHeaders(sessionToken),
    });
    const body = (await res.json()) as { commodities: any[] };

    // Agricium should have 2 listings (Area18 + New Babbage)
    const agricium = body.commodities.find((c: any) => c.name === "Agricium");
    expect(agricium).toBeDefined();
    expect(agricium.listings.length).toBe(2);

    // Hydrogen should have 2 listings (buy at Area18, sell at Grim HEX)
    const hydrogen = body.commodities.find((c: any) => c.name === "Hydrogen");
    expect(hydrogen).toBeDefined();
    expect(hydrogen.listings.length).toBe(2);

    // WiDoW should have 1 listing (Grim HEX only)
    const widow = body.commodities.find((c: any) => c.name === "WiDoW");
    expect(widow).toBeDefined();
    expect(widow.listings.length).toBe(1);
  });

  it("listings contain buy/sell prices, inventory, and location data", async () => {
    const { sessionToken } = await createTestUser(env.DB);
    const res = await SELF.fetch("http://localhost/api/gamedata/trade", {
      headers: await authHeaders(sessionToken),
    });
    const body = (await res.json()) as { commodities: any[] };
    const agricium = body.commodities.find((c: any) => c.name === "Agricium");
    const listing = agricium.listings[0];

    expect(listing).toHaveProperty("item_uuid", "aaaa-1111");
    expect(listing).toHaveProperty("buy_price");
    expect(listing).toHaveProperty("sell_price");
    expect(listing).toHaveProperty("base_inventory");
    expect(listing).toHaveProperty("max_inventory");
    expect(listing).toHaveProperty("location_label");
    expect(listing).toHaveProperty("shop_display_name");
  });

  it("demonstrates dynamic pricing — same commodity, different prices", async () => {
    const { sessionToken } = await createTestUser(env.DB);
    const res = await SELF.fetch("http://localhost/api/gamedata/trade", {
      headers: await authHeaders(sessionToken),
    });
    const body = (await res.json()) as { commodities: any[] };
    const agricium = body.commodities.find((c: any) => c.name === "Agricium");

    const sellPrices = agricium.listings
      .filter((l: any) => l.sell_price > 0)
      .map((l: any) => l.sell_price);

    // Both shops sell Agricium at different prices
    expect(sellPrices.length).toBe(2);
    expect(sellPrices[0]).not.toBe(sellPrices[1]);
  });

  it("commodity fields include category, type, description, scu_per_unit", async () => {
    const { sessionToken } = await createTestUser(env.DB);
    const res = await SELF.fetch("http://localhost/api/gamedata/trade", {
      headers: await authHeaders(sessionToken),
    });
    const body = (await res.json()) as { commodities: any[] };
    const widow = body.commodities.find((c: any) => c.name === "WiDoW");

    expect(widow.category).toBe("vice");
    expect(widow.type_name).toBe("Vice");
    expect(widow.description).toBe("A highly illegal narcotic.");
    expect(widow.scu_per_unit).toBe(0.01);
    expect(widow.boxable).toBe(1);
  });

  it("locations list is sorted and unique", async () => {
    const { sessionToken } = await createTestUser(env.DB);
    const res = await SELF.fetch("http://localhost/api/gamedata/trade", {
      headers: await authHeaders(sessionToken),
    });
    const body = (await res.json()) as { locations: string[] };

    expect(body.locations).toEqual(["Area18", "Grim HEX", "New Babbage"]);
    // Verify uniqueness
    expect(new Set(body.locations).size).toBe(body.locations.length);
  });
});
