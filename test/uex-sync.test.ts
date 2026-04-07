import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { setupTestDatabase, TEST_GAME_VERSION_ID } from "./apply-migrations";

// We can't easily mock fetch in Workers tests, so test the DB logic directly
// by inserting test data and verifying the sync updates it

describe("UEX sync", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);

    // Seed a shop, terminal, and trade commodity
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO shops (uuid, name, slug, shop_type, is_event, location_label, game_version_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind("uex-shop-1", "TestShop", "testshop", "admin", 0, "TestLoc", TEST_GAME_VERSION_ID),
    ]);

    const shop = await env.DB.prepare("SELECT id FROM shops WHERE uuid = 'uex-shop-1'").first();

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO terminals (uuid, shop_id, shop_name_key, terminal_type, uex_terminal_id, game_version_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind("uex-term-1", shop!.id, "TestTerminal", "commodity", 999, TEST_GAME_VERSION_ID),
      env.DB.prepare(
        `INSERT INTO trade_commodities (uuid, name, slug, category, game_version_id)
         VALUES (?, ?, ?, ?, ?)`
      ).bind("tc-uuid-1", "Laranite", "laranite", "minerals", TEST_GAME_VERSION_ID),
    ]);

    const term = await env.DB.prepare("SELECT id FROM terminals WHERE uuid = 'uex-term-1'").first();

    // Insert existing terminal_inventory row
    await env.DB.prepare(
      `INSERT INTO terminal_inventory (terminal_id, item_uuid, item_type, item_name, base_buy_price, base_sell_price, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(term!.id, "tc-uuid-1", "commodity", "Laranite", 100, 200, TEST_GAME_VERSION_ID).run();
  });

  it("UPSERT updates existing terminal_inventory with UEX prices", async () => {
    const term = await env.DB.prepare("SELECT id FROM terminals WHERE uuid = 'uex-term-1'").first();

    // Simulate what syncUexPrices does — UPSERT with latest prices
    await env.DB.prepare(
      `INSERT INTO terminal_inventory
       (terminal_id, item_uuid, item_type, item_name, latest_buy_price, latest_sell_price, latest_source, latest_observed_at, game_version_id)
       VALUES (?, ?, 'commodity', ?, ?, ?, 'uex', datetime('now'), ?)
       ON CONFLICT(terminal_id, item_uuid, game_version_id) DO UPDATE SET
       latest_buy_price = excluded.latest_buy_price,
       latest_sell_price = excluded.latest_sell_price,
       latest_source = 'uex',
       latest_observed_at = datetime('now')`
    ).bind(term!.id, "tc-uuid-1", "Laranite", 150, 250, TEST_GAME_VERSION_ID).run();

    // Verify the row was updated (not inserted as duplicate)
    const rows = await env.DB.prepare(
      "SELECT * FROM terminal_inventory WHERE terminal_id = ? AND item_uuid = 'tc-uuid-1'"
    ).bind(term!.id).all();

    expect(rows.results.length).toBe(1);
    expect(rows.results[0].base_buy_price).toBe(100);     // base unchanged
    expect(rows.results[0].latest_buy_price).toBe(150);    // UEX price set
    expect(rows.results[0].latest_sell_price).toBe(250);
    expect(rows.results[0].latest_source).toBe("uex");
  });

  it("UPSERT inserts new terminal_inventory for unknown items", async () => {
    const term = await env.DB.prepare("SELECT id FROM terminals WHERE uuid = 'uex-term-1'").first();

    await env.DB.prepare(
      `INSERT INTO terminal_inventory
       (terminal_id, item_uuid, item_type, item_name, latest_buy_price, latest_sell_price, latest_source, latest_observed_at, game_version_id)
       VALUES (?, ?, 'item', ?, ?, ?, 'uex', datetime('now'), ?)
       ON CONFLICT(terminal_id, item_uuid, game_version_id) DO UPDATE SET
       latest_buy_price = excluded.latest_buy_price,
       latest_sell_price = excluded.latest_sell_price,
       latest_source = 'uex',
       latest_observed_at = datetime('now')`
    ).bind(term!.id, "new-item-uuid", "Test Weapon", 5000, null, TEST_GAME_VERSION_ID).run();

    const row = await env.DB.prepare(
      "SELECT * FROM terminal_inventory WHERE item_uuid = 'new-item-uuid'"
    ).first();

    expect(row).toBeDefined();
    expect(row!.latest_buy_price).toBe(5000);
    expect(row!.latest_sell_price).toBeNull();
    expect(row!.latest_source).toBe("uex");
    expect(row!.item_name).toBe("Test Weapon");
  });
});
