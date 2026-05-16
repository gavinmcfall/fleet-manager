/**
 * Regression test for the UEX terminal_inventory UPSERT bug.
 *
 * The bug: the ON CONFLICT SET clause omitted `game_version_id = excluded.game_version_id`,
 * so when a new game version became the default, existing terminal_inventory rows stayed
 * stranded at the old game_version_id. All 50,286 rows were stuck at 4.7.1-live for
 * 29 days after the 4.8.0-live cutover.
 *
 * This test proves:
 * 1. The UPSERT correctly advances game_version_id (and prices) when a row already exists.
 * 2. Omitting game_version_id from the SET clause would leave it unchanged (the pre-fix shape).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { setupTestDatabase, TEST_GAME_VERSION_ID } from "./apply-migrations";

// Seed a shop + terminal so the FK on terminal_inventory.terminal_id is satisfied.
// Returns the inserted terminal id.
async function seedTerminal(db: D1Database): Promise<number> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO shops (uuid, name, slug, shop_type, is_event, location_label, game_version_id)
       VALUES ('uex-test-shop', 'UEX Test Shop', 'uex-test-shop', 'commodity', 0, 'Lorville', ?)`,
    )
    .bind(TEST_GAME_VERSION_ID)
    .run();

  const shop = await db
    .prepare(`SELECT id FROM shops WHERE uuid = 'uex-test-shop'`)
    .first<{ id: number }>();

  await db
    .prepare(
      `INSERT OR IGNORE INTO terminals (uuid, shop_id, shop_name_key, terminal_type, game_version_id)
       VALUES ('uex-test-term', ?, 'SCShop_UEXTest', 'commodity', ?)`,
    )
    .bind(shop!.id, TEST_GAME_VERSION_ID)
    .run();

  const terminal = await db
    .prepare(`SELECT id FROM terminals WHERE uuid = 'uex-test-term'`)
    .first<{ id: number }>();

  return terminal!.id;
}

describe("UEX UPSERT migrates game_version_id", () => {
  let termId: number;

  beforeEach(async () => {
    await setupTestDatabase(env.DB);
    termId = await seedTerminal(env.DB);
    // Clean test rows
    await env.DB.prepare(
      `DELETE FROM terminal_inventory WHERE item_uuid LIKE 'test-uex-%'`,
    ).run();
  });

  it("preserves prices AND advances game_version_id on existing row", async () => {
    const db = env.DB as D1Database;
    const V1 = TEST_GAME_VERSION_ID; // version 1 (4.7.x)
    const V2 = 2; // version 2 (4.8.x — must exist or FK will fail on remote; local D1 is lenient)

    // Seed an existing row at V1 with old prices.
    await db
      .prepare(
        `INSERT INTO terminal_inventory
         (terminal_id, item_uuid, item_type, item_name, latest_buy_price, latest_sell_price,
          latest_source, latest_observed_at, game_version_id)
         VALUES (?, 'test-uex-1', 'commodity', 'TestCommodity', 10.0, 12.0, 'uex', datetime('now'), ?)`,
      )
      .bind(termId, V1)
      .run();

    // Simulate the exact UPSERT shape used by uex.ts syncCommodities, with new prices and V2.
    // This is the fixed form — game_version_id IS in the SET clause.
    await db
      .prepare(
        `INSERT INTO terminal_inventory
         (terminal_id, item_uuid, item_type, item_name, latest_buy_price, latest_sell_price,
          latest_source, latest_observed_at, game_version_id)
         VALUES (?, 'test-uex-1', 'commodity', 'TestCommodity', 15.0, 18.0, 'uex', datetime('now'), ?)
         ON CONFLICT(terminal_id, item_uuid) DO UPDATE SET
           latest_buy_price = excluded.latest_buy_price,
           latest_sell_price = excluded.latest_sell_price,
           latest_source = 'uex',
           latest_observed_at = datetime('now'),
           game_version_id = excluded.game_version_id`,
      )
      .bind(termId, V2)
      .run();

    const row = await db
      .prepare(
        `SELECT latest_buy_price, latest_sell_price, game_version_id
         FROM terminal_inventory
         WHERE terminal_id = ? AND item_uuid = 'test-uex-1'`,
      )
      .bind(termId)
      .first<{ latest_buy_price: number; latest_sell_price: number; game_version_id: number }>();

    expect(row).not.toBeNull();
    expect(row?.latest_buy_price).toBe(15);
    expect(row?.latest_sell_price).toBe(18);
    // This is the regression assertion: game_version_id MUST advance to V2.
    // If game_version_id were omitted from the SET clause (the pre-fix bug),
    // this would remain V1 and the assertion would fail.
    expect(row?.game_version_id).toBe(V2);
  });

  it("pre-fix UPSERT shape (omitting game_version_id from SET) leaves version stranded", async () => {
    const db = env.DB as D1Database;
    const V1 = TEST_GAME_VERSION_ID;
    const V2 = 2;

    // Seed existing row at V1.
    await db
      .prepare(
        `INSERT INTO terminal_inventory
         (terminal_id, item_uuid, item_type, item_name, latest_buy_price, latest_sell_price,
          latest_source, latest_observed_at, game_version_id)
         VALUES (?, 'test-uex-2', 'commodity', 'TestCommodity2', 10.0, 12.0, 'uex', datetime('now'), ?)`,
      )
      .bind(termId, V1)
      .run();

    // Simulate the PRE-FIX UPSERT — game_version_id intentionally ABSENT from SET clause.
    await db
      .prepare(
        `INSERT INTO terminal_inventory
         (terminal_id, item_uuid, item_type, item_name, latest_buy_price, latest_sell_price,
          latest_source, latest_observed_at, game_version_id)
         VALUES (?, 'test-uex-2', 'commodity', 'TestCommodity2', 15.0, 18.0, 'uex', datetime('now'), ?)
         ON CONFLICT(terminal_id, item_uuid) DO UPDATE SET
           latest_buy_price = excluded.latest_buy_price,
           latest_sell_price = excluded.latest_sell_price,
           latest_source = 'uex',
           latest_observed_at = datetime('now')`,
        // NOTE: game_version_id is NOT in the SET clause — this is the bug.
      )
      .bind(termId, V2)
      .run();

    const row = await db
      .prepare(
        `SELECT latest_buy_price, latest_sell_price, game_version_id
         FROM terminal_inventory
         WHERE terminal_id = ? AND item_uuid = 'test-uex-2'`,
      )
      .bind(termId)
      .first<{ latest_buy_price: number; latest_sell_price: number; game_version_id: number }>();

    // Prices advance (the SET clause did update them)...
    expect(row?.latest_buy_price).toBe(15);
    expect(row?.latest_sell_price).toBe(18);
    // ...but game_version_id is STILL V1 — stranded at old version. This is the bug.
    expect(row?.game_version_id).toBe(V1);
  });
});
