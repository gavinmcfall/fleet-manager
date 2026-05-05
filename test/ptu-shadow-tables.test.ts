import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { setupTestDatabase } from "./apply-migrations";
import { VERSIONED_TABLES } from "../src/lib/ptu";

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
