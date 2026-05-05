import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { setupTestDatabase } from "./apply-migrations";
import { VERSIONED_TABLES, getActiveChannel, isPTUChannel } from "../src/lib/ptu";
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

describe("getActiveChannel", () => {
  function makeContext(url: string): any {
    const req = new Request(url);
    return { req: { raw: req, query: (k: string) => new URL(url).searchParams.get(k) } };
  }

  it("returns LIVE when no query param", () => {
    expect(getActiveChannel(makeContext("https://x/api/loot"))).toBe("LIVE");
  });

  it("returns PTU for ?channel=PTU", () => {
    expect(getActiveChannel(makeContext("https://x/api/loot?channel=PTU"))).toBe("PTU");
  });

  it("returns PTU for ?channel=ptu (case-insensitive)", () => {
    expect(getActiveChannel(makeContext("https://x/api/loot?channel=ptu"))).toBe("PTU");
  });

  it("ignores unknown values, falls back to LIVE", () => {
    expect(getActiveChannel(makeContext("https://x/api/loot?channel=garbage"))).toBe("LIVE");
  });
});

describe("isPTUChannel", () => {
  it("returns true for PTU and EPTU", () => {
    expect(isPTUChannel("PTU")).toBe(true);
    expect(isPTUChannel("EPTU")).toBe(true);
  });
  it("returns false for LIVE", () => {
    expect(isPTUChannel("LIVE")).toBe(false);
  });
});

// -------------------------------------------------------------------
// Route-level integration tests: /api/loot honors ?channel=PTU
// -------------------------------------------------------------------
//
// These tests hit the actual route handlers via SELF.fetch and assert
// channel-scoped data is returned based on the ?channel query param.
//
// Each describe block uses distinct UUIDs to avoid cross-test pollution
// (D1 state persists across tests in the same file via vitest-pool-workers).

describe("GET /api/loot honors ?channel=PTU", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
         ('33330000-0000-0000-0000-000000000001', 'ROUTE-LIVE Item', 'gear', 'common', 'gear', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
         ('33330000-0000-0000-0000-000000000002', 'ROUTE-PTU Item', 'gear', 'common', 'gear', 1)`,
      ),
    ]);
  });

  it("returns LIVE rows when channel param absent", async () => {
    const res = await SELF.fetch("http://localhost/api/loot");
    expect(res.status).toBe(200);
    const items = (await res.json()) as Array<{ name: string }>;
    const names = items.map((i) => i.name);
    expect(names).toContain("ROUTE-LIVE Item");
    expect(names).not.toContain("ROUTE-PTU Item");
  });

  it("returns PTU rows when ?channel=PTU", async () => {
    const res = await SELF.fetch("http://localhost/api/loot?channel=PTU");
    expect(res.status).toBe(200);
    const items = (await res.json()) as Array<{ name: string }>;
    const names = items.map((i) => i.name);
    expect(names).toContain("ROUTE-PTU Item");
    expect(names).not.toContain("ROUTE-LIVE Item");
  });
});

describe("GET /api/loot/:uuid honors ?channel=PTU", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
         ('44440000-0000-0000-0000-000000000001', 'ROUTE-LIVE Detail', 'gear', 'common', 'gear', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_map (uuid, name, type, rarity, category, game_version_id) VALUES
         ('44440000-0000-0000-0000-000000000001', 'ROUTE-PTU Detail', 'gear', 'common', 'gear', 1)`,
      ),
    ]);
  });

  it("returns LIVE row when channel absent", async () => {
    const res = await SELF.fetch(
      "http://localhost/api/loot/44440000-0000-0000-0000-000000000001",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string };
    expect(body.name).toBe("ROUTE-LIVE Detail");
  });

  it("returns PTU row when ?channel=PTU", async () => {
    const res = await SELF.fetch(
      "http://localhost/api/loot/44440000-0000-0000-0000-000000000001?channel=PTU",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string };
    expect(body.name).toBe("ROUTE-PTU Detail");
  });
});

describe("GET /api/loot/sets honors ?channel=PTU", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO loot_map (uuid, name, category, manufacturer_name, game_version_id) VALUES
         ('55550000-0000-0000-0000-000000000001', 'RouteLiveBrand Pioneer Helmet', 'helmet', 'RouteLiveBrand', 1),
         ('55550000-0000-0000-0000-000000000002', 'RouteLiveBrand Pioneer Core', 'armour', 'RouteLiveBrand', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_map (uuid, name, category, manufacturer_name, game_version_id) VALUES
         ('55550000-0000-0000-0000-000000000003', 'RoutePtuBrand Vanguard Helmet', 'helmet', 'RoutePtuBrand', 1),
         ('55550000-0000-0000-0000-000000000004', 'RoutePtuBrand Vanguard Core', 'armour', 'RoutePtuBrand', 1)`,
      ),
    ]);
  });

  it("returns LIVE sets when channel absent", async () => {
    const res = await SELF.fetch("http://localhost/api/loot/sets");
    expect(res.status).toBe(200);
    const sets = (await res.json()) as Array<{ manufacturer: string }>;
    const mfrs = sets.map((s) => s.manufacturer);
    expect(mfrs).toContain("RouteLiveBrand");
    expect(mfrs).not.toContain("RoutePtuBrand");
  });

  it("returns PTU sets when ?channel=PTU", async () => {
    const res = await SELF.fetch("http://localhost/api/loot/sets?channel=PTU");
    expect(res.status).toBe(200);
    const sets = (await res.json()) as Array<{ manufacturer: string }>;
    const mfrs = sets.map((s) => s.manufacturer);
    expect(mfrs).toContain("RoutePtuBrand");
    expect(mfrs).not.toContain("RouteLiveBrand");
  });
});

describe("GET /api/loot/locations honors ?channel=PTU", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO loot_map (id, uuid, name, type, rarity, category, game_version_id) VALUES
         (9301, '66660000-0000-0000-0000-000000000001', 'Route LIVE Loc', 'gear', 'Common', 'gear', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_map (id, uuid, name, type, rarity, category, game_version_id) VALUES
         (9302, '66660000-0000-0000-0000-000000000002', 'Route PTU Loc', 'gear', 'Common', 'gear', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO loot_item_locations (loot_map_id, source_type, location_key, game_version_id)
         VALUES (9301, 'container', 'route-live-container', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_item_locations (loot_map_id, source_type, location_key, game_version_id)
         VALUES (9302, 'container', 'route-ptu-container', 1)`,
      ),
    ]);
  });

  it("returns LIVE summary when channel absent", async () => {
    const res = await SELF.fetch("http://localhost/api/loot/locations");
    expect(res.status).toBe(200);
    const summary = (await res.json()) as { containers: Array<{ key: string }> };
    const keys = summary.containers.map((c) => c.key);
    expect(keys).toContain("route-live-container");
    expect(keys).not.toContain("route-ptu-container");
  });

  it("returns PTU summary when ?channel=PTU", async () => {
    const res = await SELF.fetch("http://localhost/api/loot/locations?channel=PTU");
    expect(res.status).toBe(200);
    const summary = (await res.json()) as { containers: Array<{ key: string }> };
    const keys = summary.containers.map((c) => c.key);
    expect(keys).toContain("route-ptu-container");
    expect(keys).not.toContain("route-live-container");
  });
});

describe("GET /api/loot/locations/:type/:slug honors ?channel=PTU", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO loot_map (id, uuid, name, type, rarity, category, game_version_id) VALUES
         (9401, '77770000-0000-0000-0000-000000000001', 'Route LIVE Detail Loc Item', 'gear', 'Common', 'gear', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_map (id, uuid, name, type, rarity, category, game_version_id) VALUES
         (9402, '77770000-0000-0000-0000-000000000002', 'Route PTU Detail Loc Item', 'gear', 'Common', 'gear', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO loot_item_locations (loot_map_id, source_type, location_key, game_version_id)
         VALUES (9401, 'container', 'route-shared-detail-key', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO ptu_loot_item_locations (loot_map_id, source_type, location_key, game_version_id)
         VALUES (9402, 'container', 'route-shared-detail-key', 1)`,
      ),
    ]);
  });

  it("returns LIVE items when channel absent", async () => {
    const res = await SELF.fetch(
      "http://localhost/api/loot/locations/container/route-shared-detail-key",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ name: string }> };
    const names = body.items.map((i) => i.name);
    expect(names).toContain("Route LIVE Detail Loc Item");
    expect(names).not.toContain("Route PTU Detail Loc Item");
  });

  it("returns PTU items when ?channel=PTU", async () => {
    const res = await SELF.fetch(
      "http://localhost/api/loot/locations/container/route-shared-detail-key?channel=PTU",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ name: string }> };
    const names = body.items.map((i) => i.name);
    expect(names).toContain("Route PTU Detail Loc Item");
    expect(names).not.toContain("Route LIVE Detail Loc Item");
  });
});

// -------------------------------------------------------------------
// Admin PTU purge: DELETE /api/admin/versions/ptu
// -------------------------------------------------------------------
//
// The endpoint DROPs all ptu_* tables (VERSIONED_TABLES + child junctions),
// NULLs build_number on the channel's game_versions row, and purges the
// KV cache. Re-applying migration 0215 re-creates the empty ptu_* tables.
//
// We mount adminRoutes() in a fresh Hono app to bypass the auth middleware
// configured in src/index.ts (which only fires for /api/admin/* paths there).

describe("admin PTU purge - DELETE /api/admin/versions/ptu", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    // Seed a PTU game_versions row with a build_number, plus a ptu_loot_map row
    // so we have something concrete to drop and verify.
    await env.DB.prepare(
      `INSERT OR IGNORE INTO game_versions (uuid, code, channel, is_default, released_at, build_number)
       VALUES ('test-ptu-version-purge', '4.8.0-ptu', 'PTU', 0, '2026-05-01', 'test-build-12345')`,
    ).run();
    // If the row already existed (from prior tests in same DB), make sure
    // build_number is set so we can verify the NULL update.
    await env.DB.prepare(
      `UPDATE game_versions SET build_number = 'test-build-12345' WHERE channel = 'PTU'`,
    ).run();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO ptu_loot_map (uuid, name, type, rarity, category, game_version_id)
       SELECT 'purgetest-aaaa-0001', 'PTU Purge Item', 'gear', 'common', 'gear', id
       FROM game_versions WHERE channel = 'PTU' LIMIT 1`,
    ).run();
  });

  it("seeded ptu_loot_map has the purge-test row before DELETE", async () => {
    const tables = await env.DB
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='ptu_loot_map'`,
      )
      .all<{ name: string }>();
    expect(tables.results.length).toBe(1);
    const row = await env.DB
      .prepare(`SELECT name FROM ptu_loot_map WHERE uuid = 'purgetest-aaaa-0001'`)
      .first<{ name: string }>();
    expect(row?.name).toBe("PTU Purge Item");
  });

  it("DROPs all ptu_* tables and NULLs build_number when the endpoint is invoked", async () => {
    // Pre-conditions: build_number is set
    const before = await env.DB
      .prepare(`SELECT build_number FROM game_versions WHERE channel = 'PTU' LIMIT 1`)
      .first<{ build_number: string | null }>();
    expect(before?.build_number).toBe("test-build-12345");

    const ptuTablesBefore = await env.DB
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ptu_%'`)
      .all<{ name: string }>();
    expect(ptuTablesBefore.results.length).toBeGreaterThan(0);

    // Mount adminRoutes() in a fresh Hono app to bypass /api/admin/* auth middleware.
    const { Hono } = await import("hono");
    const { adminRoutes } = await import("../src/routes/admin");
    const app = new Hono();
    app.route("/api/admin", adminRoutes());

    // Provide a minimal env: real D1 + the SC_BRIDGE_CACHE KV from miniflare.
    // miniflare exposes the KV namespace via env, but cloudflare:test only
    // re-exports DB. Stub the KV with the methods purgeByPrefix needs.
    const fakeKv = {
      list: async () => ({ keys: [], list_complete: true, cursor: undefined }),
      delete: async () => undefined,
      get: async () => null,
      put: async () => undefined,
    };

    const res = await app.request(
      "/api/admin/versions/ptu",
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "PTU" }),
      },
      { DB: env.DB, SC_BRIDGE_CACHE: fakeKv } as unknown as Record<string, unknown>,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; tables_purged: number; channel: string };
    expect(body.ok).toBe(true);
    expect(body.channel).toBe("PTU");
    expect(body.tables_purged).toBeGreaterThan(0);

    // Post-conditions: ptu_loot_map (and all other ptu_*) tables are gone.
    const ptuTablesAfter = await env.DB
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ptu_%'`)
      .all<{ name: string }>();
    expect(ptuTablesAfter.results.length).toBe(0);

    // build_number cleared on the channel row.
    const after = await env.DB
      .prepare(`SELECT build_number FROM game_versions WHERE channel = 'PTU' LIMIT 1`)
      .first<{ build_number: string | null }>();
    expect(after?.build_number).toBeNull();
  });

  it("returns 404 when the requested channel has no game_versions row", async () => {
    // Make sure no EPTU row exists for this assertion.
    await env.DB
      .prepare(`DELETE FROM game_versions WHERE channel = 'EPTU'`)
      .run();

    const { Hono } = await import("hono");
    const { adminRoutes } = await import("../src/routes/admin");
    const app = new Hono();
    app.route("/api/admin", adminRoutes());

    const fakeKv = {
      list: async () => ({ keys: [], list_complete: true, cursor: undefined }),
      delete: async () => undefined,
      get: async () => null,
      put: async () => undefined,
    };

    const res = await app.request(
      "/api/admin/versions/ptu",
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "EPTU" }),
      },
      { DB: env.DB, SC_BRIDGE_CACHE: fakeKv } as unknown as Record<string, unknown>,
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("EPTU");
  });
});
