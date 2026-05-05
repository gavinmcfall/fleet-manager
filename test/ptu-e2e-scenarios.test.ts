/**
 * Worker E2E SQL semantics scenarios for PTU shadow tables.
 *
 * Five lifecycle scenarios that exercise the SQL-level behavior of PTU
 * shadow tables under each event in a real patch cycle. These complement
 * the route-level tests in ptu-shadow-tables.test.ts by going directly
 * through env.DB rather than the loader pipeline.
 *
 *  13. Cold PTU load — empty ptu_loot_map → 4 PTU records (2 shared + 2 PTU-only)
 *  14. Incremental PTU build — UPSERT with no-op skip + sweep of cut rows
 *  15. Mid-cycle LIVE patch — base UPSERT must not touch ptu_*
 *  16. Major LIVE drop — DROP TABLE IF EXISTS ptu_* per VERSIONED_TABLES
 *  17. Concurrent dual-channel reads — interleaved LIVE/PTU queries
 */
import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDatabase } from "./apply-migrations";
import { getLootItems } from "../src/db/queries";
import { VERSIONED_TABLES } from "../src/lib/ptu";

// -------------------------------------------------------------------
// Task 13: Cold PTU load
// -------------------------------------------------------------------
describe("Scenario: cold PTU load", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    await env.DB.prepare(`DELETE FROM loot_map`).run();
    await env.DB.prepare(`DELETE FROM ptu_loot_map`).run();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
         ('live-001', 'LIVE Item A', 'gear', 'common', 'gear', 1),
         ('live-002', 'LIVE Item B', 'gear', 'rare', 'gear', 1),
         ('live-003', 'LIVE Item C (gone in 4.8)', 'gear', 'epic', 'gear', 1)`,
      ),
    ]);
  });

  it("starts with empty ptu_loot_map", async () => {
    const r = await env.DB
      .prepare(`SELECT COUNT(*) as c FROM ptu_loot_map`)
      .first<{ c: number }>();
    expect(r?.c).toBe(0);
  });

  it("loads PTU build 1: 4 records, 2 shared with LIVE + 2 PTU-only", async () => {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO ptu_loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
         ('live-001', 'PTU Item A (tweaked)', 'gear', 'common', 'gear', 1),
         ('live-002', 'LIVE Item B', 'gear', 'rare', 'gear', 1),
         ('ptu-new-001', 'PTU New Item 1', 'gear', 'legendary', 'gear', 1),
         ('ptu-new-002', 'PTU New Item 2', 'gear', 'legendary', 'gear', 1)`,
      ),
    ]);

    const live = await getLootItems(env.DB, false);
    const ptu = await getLootItems(env.DB, true);

    const liveNames = live
      .map((i: { name: string }) => i.name)
      .filter((n) => n.startsWith("LIVE Item"))
      .sort();
    expect(liveNames).toEqual([
      "LIVE Item A",
      "LIVE Item B",
      "LIVE Item C (gone in 4.8)",
    ]);

    const ptuNames = ptu
      .map((i: { name: string }) => i.name)
      .filter(
        (n) =>
          n === "LIVE Item B" ||
          n === "PTU Item A (tweaked)" ||
          n.startsWith("PTU New Item"),
      )
      .sort();
    expect(ptuNames).toEqual([
      "LIVE Item B",
      "PTU Item A (tweaked)",
      "PTU New Item 1",
      "PTU New Item 2",
    ]);
  });
});

// -------------------------------------------------------------------
// Task 14: Incremental PTU build (build 1 → build 2)
// -------------------------------------------------------------------
describe("Scenario: incremental PTU build (build 1 → build 2)", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
  });

  beforeEach(async () => {
    await env.DB.prepare(`DELETE FROM ptu_loot_map`).run();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO ptu_loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
         ('shared-001', 'Shared Item Build 1', 'gear', 'common', 'gear', 1),
         ('shared-002', 'Stable Across Builds', 'gear', 'rare', 'gear', 1),
         ('only-build1', 'Will Be Cut', 'gear', 'epic', 'gear', 1)`,
      ),
    ]);
  });

  it("UPSERT with no-op skip preserves rows whose values match, sweep deletes cut rows", async () => {
    const buildTwoSQL = `
      INSERT INTO ptu_loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
        ('shared-001', 'Shared Item Build 2 (modified)', 'gear', 'common', 'gear', 1),
        ('shared-002', 'Stable Across Builds', 'gear', 'rare', 'gear', 1),
        ('new-build2', 'Build 2 Addition', 'gear', 'legendary', 'gear', 1)
      ON CONFLICT(uuid) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        rarity = excluded.rarity,
        category = excluded.category,
        game_version_id = excluded.game_version_id
      WHERE
        ptu_loot_map.name IS NOT excluded.name
        OR ptu_loot_map.type IS NOT excluded.type
        OR ptu_loot_map.rarity IS NOT excluded.rarity
        OR ptu_loot_map.category IS NOT excluded.category
        OR ptu_loot_map.game_version_id IS NOT excluded.game_version_id;
    `;
    await env.DB.exec(buildTwoSQL.replace(/\s+/g, " ").trim());

    const buildTwoUUIDs = ["shared-001", "shared-002", "new-build2"];
    const placeholders = buildTwoUUIDs.map(() => "?").join(",");
    await env.DB.prepare(
      `UPDATE ptu_loot_map SET is_deleted = 1
       WHERE uuid NOT IN (${placeholders}) AND is_deleted = 0`,
    )
      .bind(...buildTwoUUIDs)
      .run();

    // Verify the active (non-deleted) set in the DB directly. getLootItems
    // doesn't filter is_deleted yet, so we go straight to the table to assert
    // sweep semantics. This mirrors how the channel-aware UI would gate.
    const active = await env.DB
      .prepare(
        `SELECT name FROM ptu_loot_map WHERE is_deleted = 0 ORDER BY name ASC`,
      )
      .all<{ name: string }>();
    const activeNames = active.results.map((r) => r.name).sort();
    expect(activeNames).toEqual([
      "Build 2 Addition",
      "Shared Item Build 2 (modified)",
      "Stable Across Builds",
    ]);
    expect(activeNames).not.toContain("Will Be Cut");

    // Cut row still exists in the table but soft-deleted.
    const cut = await env.DB
      .prepare(`SELECT is_deleted FROM ptu_loot_map WHERE uuid = 'only-build1'`)
      .first<{ is_deleted: number }>();
    expect(cut?.is_deleted).toBe(1);

    // Sanity: getLootItems still returns the soft-deleted row (current behavior;
    // future filter on is_deleted would change this). Confirms the row physically
    // remains in the table.
    const ptu = await getLootItems(env.DB, true);
    const ptuNames = ptu.map((i: { name: string }) => i.name);
    expect(ptuNames).toContain("Will Be Cut");
  });
});

// -------------------------------------------------------------------
// Task 15: Mid-cycle LIVE patch
// -------------------------------------------------------------------
describe("Scenario: mid-cycle LIVE patch with PTU loaded", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
  });

  beforeEach(async () => {
    await env.DB.prepare(`DELETE FROM loot_map`).run();
    await env.DB.prepare(`DELETE FROM ptu_loot_map`).run();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
         ('item-1', 'v4.7.1 Item 1', 'gear', 'common', 'gear', 1),
         ('item-2', 'v4.7.1 Item 2', 'gear', 'rare', 'gear', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
         ('item-1', 'v4.8 PTU Item 1', 'gear', 'common', 'gear', 1),
         ('item-2', 'v4.8 PTU Item 2', 'gear', 'rare', 'gear', 1),
         ('ptu-new', 'v4.8 PTU New', 'gear', 'epic', 'gear', 1)`,
      ),
    ]);
  });

  it("4.7.2 LIVE patch updates base only; ptu_* untouched", async () => {
    const patch = `
      INSERT INTO loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
        ('item-1', 'v4.7.2 Item 1 (rebalanced)', 'gear', 'common', 'gear', 1),
        ('item-2', 'v4.7.1 Item 2', 'gear', 'rare', 'gear', 1),
        ('item-3', 'v4.7.2 NEW', 'gear', 'epic', 'gear', 1)
      ON CONFLICT(uuid) DO UPDATE SET
        name = excluded.name, type = excluded.type, rarity = excluded.rarity,
        category = excluded.category, game_version_id = excluded.game_version_id
      WHERE loot_map.name IS NOT excluded.name
        OR loot_map.type IS NOT excluded.type
        OR loot_map.rarity IS NOT excluded.rarity
        OR loot_map.category IS NOT excluded.category
        OR loot_map.game_version_id IS NOT excluded.game_version_id;
    `;
    await env.DB.exec(patch.replace(/\s+/g, " ").trim());
    await env.DB.prepare(
      `UPDATE loot_map SET is_deleted = 1
       WHERE uuid NOT IN ('item-1','item-2','item-3') AND is_deleted = 0`,
    ).run();

    const live = (await getLootItems(env.DB, false))
      .map((i: { name: string }) => i.name)
      .filter((n) => n.startsWith("v4.7"))
      .sort();
    const ptu = (await getLootItems(env.DB, true))
      .map((i: { name: string }) => i.name)
      .filter((n) => n.startsWith("v4.8 PTU"))
      .sort();

    expect(live).toEqual([
      "v4.7.1 Item 2",
      "v4.7.2 Item 1 (rebalanced)",
      "v4.7.2 NEW",
    ]);
    expect(ptu).toEqual([
      "v4.8 PTU Item 1",
      "v4.8 PTU Item 2",
      "v4.8 PTU New",
    ]);
  });
});

// -------------------------------------------------------------------
// Task 16: Major LIVE drop ends PTU cycle
// -------------------------------------------------------------------
describe("Scenario: major LIVE drop ends PTU cycle", () => {
  beforeEach(async () => {
    // Ensure ptu_* tables exist (a prior test in this describe may have dropped them)
    await setupTestDatabase(env.DB);
    await env.DB.prepare(`DELETE FROM loot_map`).run();
    await env.DB.prepare(`DELETE FROM ptu_loot_map`).run();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
         ('item-1', 'v4.7.x', 'gear', 'common', 'gear', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
         ('item-1', 'v4.8 PTU', 'gear', 'common', 'gear', 1),
         ('ptu-new', 'PTU-only (cut from LIVE)', 'gear', 'epic', 'gear', 1)`,
      ),
    ]);
  });

  it("4.8 LIVE drop: base updated, ptu_* tables DROPped", async () => {
    const liveDrop = `
      INSERT INTO loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
        ('item-1', 'v4.8 LIVE', 'gear', 'common', 'gear', 1),
        ('item-2', 'v4.8 LIVE NEW', 'gear', 'rare', 'gear', 1)
      ON CONFLICT(uuid) DO UPDATE SET
        name = excluded.name, type = excluded.type,
        rarity = excluded.rarity, category = excluded.category,
        game_version_id = excluded.game_version_id
      WHERE loot_map.name IS NOT excluded.name OR loot_map.type IS NOT excluded.type;
    `;
    await env.DB.exec(liveDrop.replace(/\s+/g, " ").trim());
    for (const t of VERSIONED_TABLES) {
      await env.DB.prepare(`DROP TABLE IF EXISTS ptu_${t}`).run();
    }

    const live = (await getLootItems(env.DB, false))
      .map((i: { name: string }) => i.name)
      .filter((n) => n.startsWith("v4.8 LIVE"))
      .sort();
    expect(live).toEqual(["v4.8 LIVE", "v4.8 LIVE NEW"]);

    const tables = await env.DB
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='ptu_loot_map'`,
      )
      .all();
    expect(tables.results.length).toBe(0);
  });

  it("re-running migration recreates ptu_* tables for next PTU cycle", async () => {
    // Simulate post-major-LIVE state: ptu_* tables are gone.
    for (const t of VERSIONED_TABLES) {
      await env.DB.prepare(`DROP TABLE IF EXISTS ptu_${t}`).run();
    }
    const beforeTables = await env.DB
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='ptu_loot_map'`,
      )
      .all();
    expect(beforeTables.results.length).toBe(0);

    // applyD1Migrations is idempotent against the d1_migrations meta table —
    // it won't re-run a migration that's already recorded as applied. So to
    // verify the migration's CREATE statements are themselves idempotent and
    // can recreate dropped tables, we replay the 0215 migration's queries
    // directly. (This is what the admin purge → next PTU load cycle does
    // in production: the loader pipeline re-runs the migration manually.)
    const ptuMigration = env.TEST_MIGRATIONS.find((m) =>
      m.name.includes("0215_ptu_shadow_tables"),
    );
    expect(ptuMigration).toBeDefined();
    for (const q of ptuMigration!.queries) {
      // Skip empty/whitespace-only statements that survived parsing.
      if (q.trim().length === 0) continue;
      await env.DB.prepare(q).run();
    }

    const r = await env.DB
      .prepare(`SELECT COUNT(*) as c FROM ptu_loot_map`)
      .first<{ c: number }>();
    expect(r?.c).toBe(0);

    // And every VERSIONED_TABLES mirror is back.
    const after = await env.DB
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ptu_%'`,
      )
      .all<{ name: string }>();
    const recreated = new Set(after.results.map((r) => r.name));
    for (const t of VERSIONED_TABLES) {
      expect(recreated.has(`ptu_${t}`)).toBe(true);
    }
  });
});

// -------------------------------------------------------------------
// Task 17: Concurrent dual-channel reads
// -------------------------------------------------------------------
describe("Scenario: concurrent reads on both channels", () => {
  beforeEach(async () => {
    // Re-create tables (in case a prior test in this file dropped them) and reseed.
    await setupTestDatabase(env.DB);
    await env.DB.prepare(`DELETE FROM loot_map`).run();
    await env.DB.prepare(`DELETE FROM ptu_loot_map`).run();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
         ('a', 'LIVE A', 'gear', 'common', 'gear', 1),
         ('b', 'LIVE B', 'gear', 'rare', 'gear', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
         ('a', 'PTU A', 'gear', 'common', 'gear', 1),
         ('b', 'PTU B', 'gear', 'rare', 'gear', 1),
         ('c', 'PTU-only C', 'gear', 'epic', 'gear', 1)`,
      ),
    ]);
  });

  it("interleaved isPTU=false and isPTU=true reads return correct rows", async () => {
    const results = await Promise.all([
      getLootItems(env.DB, false),
      getLootItems(env.DB, true),
      getLootItems(env.DB, false),
      getLootItems(env.DB, true),
    ]);

    const liveOnce = results[0]
      .map((i: { name: string }) => i.name)
      .filter((n) => n === "LIVE A" || n === "LIVE B")
      .sort();
    const ptuOnce = results[1]
      .map((i: { name: string }) => i.name)
      .filter((n) => n === "PTU A" || n === "PTU B" || n === "PTU-only C")
      .sort();
    const liveTwice = results[2]
      .map((i: { name: string }) => i.name)
      .filter((n) => n === "LIVE A" || n === "LIVE B")
      .sort();
    const ptuTwice = results[3]
      .map((i: { name: string }) => i.name)
      .filter((n) => n === "PTU A" || n === "PTU B" || n === "PTU-only C")
      .sort();

    expect(liveOnce).toEqual(["LIVE A", "LIVE B"]);
    expect(ptuOnce).toEqual(["PTU A", "PTU B", "PTU-only C"]);
    expect(liveTwice).toEqual(liveOnce);
    expect(ptuTwice).toEqual(ptuOnce);
  });
});
