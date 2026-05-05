import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { setupTestDatabase } from "./apply-migrations";
import { VERSIONED_TABLES } from "../src/lib/ptu";
import {
  getLootItems,
  getLootByUuid,
  getLootSets,
  getLootSetBySlug,
  getLootLocationSummary,
  getLootLocationDetail,
  getUserLootWishlist,
} from "../src/db/queries";

describe("PTU shadow tables migration", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
  });

  it("creates a ptu_* mirror for every VERSIONED_TABLES entry", async () => {
    const result = await env.DB
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ptu_%'`,
      )
      .all<{ name: string }>();
    const ptuTables = new Set(result.results.map((r) => r.name));
    for (const base of VERSIONED_TABLES) {
      expect(ptuTables.has(`ptu_${base}`)).toBe(true);
    }
  });

  it("ptu_loot_item_locations.loot_map_id references ptu_loot_map(id)", async () => {
    const result = await env.DB
      .prepare(`PRAGMA foreign_key_list('ptu_loot_item_locations')`)
      .all<{ table: string; from: string; to: string }>();
    const fk = result.results.find((r) => r.from === "loot_map_id");
    expect(fk).toBeDefined();
    expect(fk!.table).toBe("ptu_loot_map");
    expect(fk!.to).toBe("id");
  });

  it("ptu_* tables share game_versions FK with base", async () => {
    const result = await env.DB
      .prepare(`PRAGMA foreign_key_list('ptu_loot_map')`)
      .all<{ table: string; from: string }>();
    const gvFk = result.results.find((r) => r.from === "game_version_id");
    expect(gvFk).toBeDefined();
    expect(gvFk!.table).toBe("game_versions");
  });
});

describe("getLootItems channel routing", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    // Seed ONE row in base loot_map and ONE different row in ptu_loot_map.
    // category set to a non-ship value so the WHERE clause's
    // `NOT (class_name LIKE 'vncl_%' AND category IN ('ship_component','ship_weapon'))`
    // resolves to TRUE (NULL category would yield NULL via three-valued logic and filter the row).
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
         ('aaaa0000-0000-0000-0000-000000000001', 'LIVE-only Item', 'gear', 'common', 'gear', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
         ('bbbb0000-0000-0000-0000-000000000001', 'PTU-only Item', 'gear', 'common', 'gear', 1)`,
      ),
    ]);
  });

  it("returns base table data when isPTU=false (default)", async () => {
    const items = await getLootItems(env.DB);
    const names = items.map((i: { name: string }) => i.name);
    expect(names).toContain("LIVE-only Item");
    expect(names).not.toContain("PTU-only Item");
  });

  it("returns ptu_* table data when isPTU=true", async () => {
    const items = await getLootItems(env.DB, true);
    const names = items.map((i: { name: string }) => i.name);
    expect(names).toContain("PTU-only Item");
    expect(names).not.toContain("LIVE-only Item");
  });
});

describe("getLootByUuid channel routing", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    // Same UUID in both base and ptu_loot_map but different name — proves
    // channel routing distinguishes them (otherwise either both rows or
    // neither would be returned).
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
         ('cccc0000-0000-0000-0000-000000000001', 'LIVE Detail Item', 'gear', 'common', 'gear', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
         ('cccc0000-0000-0000-0000-000000000001', 'PTU Detail Item', 'gear', 'common', 'gear', 1)`,
      ),
    ]);
  });

  it("returns base loot_map row when isPTU=false (default)", async () => {
    const row = await getLootByUuid(env.DB, "cccc0000-0000-0000-0000-000000000001");
    expect(row).toBeTruthy();
    expect((row as { name: string }).name).toBe("LIVE Detail Item");
  });

  it("returns ptu_loot_map row when isPTU=true", async () => {
    const row = await getLootByUuid(env.DB, "cccc0000-0000-0000-0000-000000000001", true);
    expect(row).toBeTruthy();
    expect((row as { name: string }).name).toBe("PTU Detail Item");
  });
});

describe("getLootSets channel routing", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO loot_map (uuid, name, category, manufacturer_name, game_version_id) VALUES
         ('dddd0000-0000-0000-0000-000000000001', 'LIVESET Helmet', 'helmet', 'TestMfr', 1),
         ('dddd0000-0000-0000-0000-000000000002', 'LIVESET Core', 'armour', 'TestMfr', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_map (uuid, name, category, manufacturer_name, game_version_id) VALUES
         ('dddd0000-0000-0000-0000-000000000003', 'PTUSET Helmet', 'helmet', 'TestMfr', 1),
         ('dddd0000-0000-0000-0000-000000000004', 'PTUSET Core', 'armour', 'TestMfr', 1)`,
      ),
    ]);
  });

  it("returns base set summaries when isPTU=false", async () => {
    const sets = await getLootSets(env.DB);
    const names = sets.map((s) => s.setName);
    expect(names.some((n) => n.includes("LIVESET"))).toBe(true);
    expect(names.some((n) => n.includes("PTUSET"))).toBe(false);
  });

  it("returns ptu_loot_map set summaries when isPTU=true", async () => {
    const sets = await getLootSets(env.DB, true);
    const names = sets.map((s) => s.setName);
    expect(names.some((n) => n.includes("PTUSET"))).toBe(true);
    expect(names.some((n) => n.includes("LIVESET"))).toBe(false);
  });
});

describe("getLootSetBySlug channel routing", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO loot_map (uuid, name, category, manufacturer_name, game_version_id) VALUES
         ('eeee0000-0000-0000-0000-000000000001', 'LiveBrand Pioneer Helmet', 'helmet', 'LiveBrand', 1),
         ('eeee0000-0000-0000-0000-000000000002', 'LiveBrand Pioneer Core', 'armour', 'LiveBrand', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_map (uuid, name, category, manufacturer_name, game_version_id) VALUES
         ('eeee0000-0000-0000-0000-000000000003', 'PtuBrand Vanguard Helmet', 'helmet', 'PtuBrand', 1),
         ('eeee0000-0000-0000-0000-000000000004', 'PtuBrand Vanguard Core', 'armour', 'PtuBrand', 1)`,
      ),
    ]);
  });

  it("resolves base set slug when isPTU=false", async () => {
    // Find the slug emitted by getLootSets first, then ask getLootSetBySlug for it.
    const liveSets = await getLootSets(env.DB);
    const live = liveSets.find((s) => s.manufacturer === "LiveBrand");
    expect(live).toBeDefined();
    const detail = await getLootSetBySlug(env.DB, live!.slug);
    expect(detail).toBeTruthy();
    expect(detail!.manufacturer).toBe("LiveBrand");
    // base data only — should not contain ptu rows
    const pieceNames = detail!.pieces.map((p) => p.name as string);
    expect(pieceNames.some((n) => n.includes("LiveBrand"))).toBe(true);
    expect(pieceNames.some((n) => n.includes("PtuBrand"))).toBe(false);
  });

  it("resolves ptu set slug when isPTU=true", async () => {
    const ptuSets = await getLootSets(env.DB, true);
    const ptu = ptuSets.find((s) => s.manufacturer === "PtuBrand");
    expect(ptu).toBeDefined();
    const detail = await getLootSetBySlug(env.DB, ptu!.slug, true);
    expect(detail).toBeTruthy();
    expect(detail!.manufacturer).toBe("PtuBrand");
    const pieceNames = detail!.pieces.map((p) => p.name as string);
    expect(pieceNames.some((n) => n.includes("PtuBrand"))).toBe(true);
    expect(pieceNames.some((n) => n.includes("LiveBrand"))).toBe(false);
  });
});

describe("getLootLocationSummary channel routing", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    // Seed loot_map rows in both channels and link them via loot_item_locations
    // so the summary aggregation has at least one container per channel.
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO loot_map (id, uuid, name, type, rarity, category, game_version_id) VALUES
         (9001, 'ffff0000-0000-0000-0000-000000000001', 'LIVE Loc Item', 'gear', 'Common', 'gear', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_map (id, uuid, name, type, rarity, category, game_version_id) VALUES
         (9002, 'ffff0000-0000-0000-0000-000000000002', 'PTU Loc Item', 'gear', 'Common', 'gear', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO loot_item_locations (loot_map_id, source_type, location_key, game_version_id)
         VALUES (9001, 'container', 'live-only-container', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_item_locations (loot_map_id, source_type, location_key, game_version_id)
         VALUES (9002, 'container', 'ptu-only-container', 1)`,
      ),
    ]);
  });

  it("returns base location summary when isPTU=false", async () => {
    const summary = await getLootLocationSummary(env.DB);
    const keys = summary.containers.map((c) => c.key);
    expect(keys).toContain("live-only-container");
    expect(keys).not.toContain("ptu-only-container");
  });

  it("returns ptu_* location summary when isPTU=true", async () => {
    const summary = await getLootLocationSummary(env.DB, true);
    const keys = summary.containers.map((c) => c.key);
    expect(keys).toContain("ptu-only-container");
    expect(keys).not.toContain("live-only-container");
  });
});

describe("getLootLocationDetail channel routing", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO loot_map (id, uuid, name, type, rarity, category, game_version_id) VALUES
         (9101, '11110000-0000-0000-0000-000000000001', 'LIVE Detail Loc Item', 'gear', 'Common', 'gear', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_map (id, uuid, name, type, rarity, category, game_version_id) VALUES
         (9102, '11110000-0000-0000-0000-000000000002', 'PTU Detail Loc Item', 'gear', 'Common', 'gear', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO loot_item_locations (loot_map_id, source_type, location_key, game_version_id)
         VALUES (9101, 'container', 'shared-detail-key', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_item_locations (loot_map_id, source_type, location_key, game_version_id)
         VALUES (9102, 'container', 'shared-detail-key', 1)`,
      ),
    ]);
  });

  it("returns base items when isPTU=false", async () => {
    const result = await getLootLocationDetail(env.DB, "container", "shared-detail-key");
    const names = result.items.map((i) => i.name);
    expect(names).toContain("LIVE Detail Loc Item");
    expect(names).not.toContain("PTU Detail Loc Item");
  });

  it("returns ptu_* items when isPTU=true", async () => {
    const result = await getLootLocationDetail(env.DB, "container", "shared-detail-key", true);
    const names = result.items.map((i) => i.name);
    expect(names).toContain("PTU Detail Loc Item");
    expect(names).not.toContain("LIVE Detail Loc Item");
  });
});

describe("getUserLootWishlist channel routing", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    // Seed loot_map rows in both channels with the same internal id so the
    // wishlist FK matches in either case. user_loot_wishlist is a user table
    // (not channel-aware), but the JOINed loot_map IS — and that's the row
    // whose name we read.
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO loot_map (id, uuid, name, type, rarity, category, game_version_id) VALUES
         (9201, '22220000-0000-0000-0000-000000000001', 'LIVE Wishlist Item', 'gear', 'Common', 'gear', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_map (id, uuid, name, type, rarity, category, game_version_id) VALUES
         (9201, '22220000-0000-0000-0000-000000000002', 'PTU Wishlist Item', 'gear', 'Common', 'gear', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
         VALUES ('wishlist-user', 'Wishlist User', 'wishlist@test', 1, datetime('now'), datetime('now'))`,
      ),
      env.DB.prepare(
        `INSERT INTO user_loot_wishlist (user_id, loot_map_id, quantity)
         VALUES ('wishlist-user', 9201, 1)`,
      ),
    ]);
  });

  it("returns base loot_map name when isPTU=false", async () => {
    const items = await getUserLootWishlist(env.DB, "wishlist-user");
    const names = items.map((i) => i.name);
    expect(names).toContain("LIVE Wishlist Item");
    expect(names).not.toContain("PTU Wishlist Item");
  });

  it("returns ptu_loot_map name when isPTU=true", async () => {
    const items = await getUserLootWishlist(env.DB, "wishlist-user", true);
    const names = items.map((i) => i.name);
    expect(names).toContain("PTU Wishlist Item");
    expect(names).not.toContain("LIVE Wishlist Item");
  });
});
