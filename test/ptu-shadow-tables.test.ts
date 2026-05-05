import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { setupTestDatabase } from "./apply-migrations";
import { VERSIONED_TABLES } from "../src/lib/ptu";
import { getLootItems } from "../src/db/queries";

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
