import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { setupTestDatabase } from "./apply-migrations";
import { createAdminUser, authHeaders } from "./helpers";

/**
 * Test the PTU data purge endpoint (DELETE /api/admin/versions/ptu).
 *
 * Seeds a PTU game_version with data across multiple versioned tables,
 * then verifies the purge deletes all PTU data while preserving LIVE data.
 */

// All versioned tables referenced by the purge endpoint, in the same order
const VERSIONED_TABLES = [
  "vehicle_weapon_racks", "vehicle_suit_lockers", "vehicle_ports",
  "salvageable_ships", "vehicle_roles", "vehicle_careers",
  "loot_item_locations", "loot_map", "vehicle_components",
  "shop_locations", "shop_inventory",
  "missions", "mission_givers", "star_map_locations", "star_systems",
  "ship_missiles", "reputation_perks", "reputation_standings",
  "faction_reputation_scopes", "reputation_scopes", "reputation_reward_tiers",
  "npc_loadout_items", "npc_loadouts",
  "rock_compositions", "mining_quality_distributions", "mining_modules",
  "mining_locations", "mining_lasers", "mining_gadgets",
  "mining_clustering_presets", "mineable_elements",
  "mission_types", "mission_organizations",
  "fps_weapons", "fps_utilities", "fps_melee", "fps_helmets",
  "fps_clothing", "fps_attachments", "fps_armour", "fps_ammo",
  "consumables", "props",
  "shops",
  "vehicles", "manufacturers",
  "jurisdiction_infraction_overrides", "law_jurisdictions", "law_infractions",
  "harvestables", "fps_carryables", "fps_ammo_types", "consumable_effects",
  "factions", "damage_types", "armor_resistance_profiles",
  "trade_commodities", "commodities", "contracts",
  "crafting_resources", "crafting_blueprints",
  "refining_processes",
];

// Child tables deleted via FK subquery (no game_version_id column)
const CHILD_TABLES = [
  "crafting_slot_modifiers",
  "crafting_blueprint_slots",
  "mining_location_deposits",
  "salvageable_ship_components",
];

// Lookup table cleaned up after parent delete
const CLEANUP_TABLES = ["npc_factions"];

describe("PTU Purge (DELETE /api/admin/versions/ptu)", () => {
  let adminToken: string;

  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    const admin = await createAdminUser(env.DB);
    adminToken = admin.sessionToken;
  });

  describe("schema validation", () => {
    it("all versioned tables exist in the database", async () => {
      for (const table of VERSIONED_TABLES) {
        const row = await env.DB
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
          .bind(table)
          .first<{ name: string }>();
        expect(row, `Table '${table}' does not exist`).not.toBeNull();
      }
    });

    it("all child tables exist in the database", async () => {
      for (const table of CHILD_TABLES) {
        const row = await env.DB
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
          .bind(table)
          .first<{ name: string }>();
        expect(row, `Child table '${table}' does not exist`).not.toBeNull();
      }
    });

    it("all cleanup tables exist in the database", async () => {
      for (const table of CLEANUP_TABLES) {
        const row = await env.DB
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
          .bind(table)
          .first<{ name: string }>();
        expect(row, `Cleanup table '${table}' does not exist`).not.toBeNull();
      }
    });

    it("all versioned tables have a game_version_id column", async () => {
      for (const table of VERSIONED_TABLES) {
        const cols = await env.DB
          .prepare(`PRAGMA table_info(${table})`)
          .all<{ name: string }>();
        const colNames = cols.results.map((c) => c.name);
        expect(colNames, `Table '${table}' missing game_version_id column`).toContain("game_version_id");
      }
    });

    it("npc_loadouts has faction_id column (not npc_faction_id)", async () => {
      const cols = await env.DB
        .prepare("PRAGMA table_info(npc_loadouts)")
        .all<{ name: string }>();
      const colNames = cols.results.map((c) => c.name);
      expect(colNames).toContain("faction_id");
      expect(colNames).not.toContain("npc_faction_id");
    });
  });

  describe("purge endpoint", () => {
    let ptuVersionId: number;
    let liveVersionId: number;

    beforeEach(async () => {
      // Get the default (LIVE) version
      const live = await env.DB
        .prepare("SELECT id FROM game_versions WHERE is_default = 1")
        .first<{ id: number }>();
      liveVersionId = live!.id;

      // Create a PTU version
      await env.DB
        .prepare(
          "INSERT OR IGNORE INTO game_versions (uuid, code, channel, is_default, build_number) VALUES ('ptu-test-uuid', '4.7.0-ptu', 'PTU', 0, '12345678')"
        )
        .run();
      const ptu = await env.DB
        .prepare("SELECT id FROM game_versions WHERE code = '4.7.0-ptu'")
        .first<{ id: number }>();
      ptuVersionId = ptu!.id;

      // Seed a manufacturer for both versions (needed as FK parent)
      await env.DB.batch([
        env.DB.prepare(
          "INSERT OR IGNORE INTO manufacturers (uuid, name, code, game_version_id) VALUES ('mfr-live', 'Live Mfr', 'LMFR', ?)"
        ).bind(liveVersionId),
        env.DB.prepare(
          "INSERT OR IGNORE INTO manufacturers (uuid, name, code, game_version_id) VALUES ('mfr-ptu', 'PTU Mfr', 'PMFR', ?)"
        ).bind(ptuVersionId),
      ]);

      // Seed a vehicle for both versions
      await env.DB.batch([
        env.DB.prepare(
          "INSERT OR IGNORE INTO vehicles (uuid, slug, name, game_version_id, manufacturer_id) VALUES ('v-live', 'test-ship-live', 'Live Ship', ?, (SELECT id FROM manufacturers WHERE uuid = 'mfr-live'))"
        ).bind(liveVersionId),
        env.DB.prepare(
          "INSERT OR IGNORE INTO vehicles (uuid, slug, name, game_version_id, manufacturer_id) VALUES ('v-ptu', 'test-ship-ptu', 'PTU Ship', ?, (SELECT id FROM manufacturers WHERE uuid = 'mfr-ptu'))"
        ).bind(ptuVersionId),
      ]);

      // Seed a faction for PTU (tests npc_factions cleanup)
      await env.DB
        .prepare("INSERT OR IGNORE INTO npc_factions (code, name) VALUES ('test_faction', 'Test Faction')")
        .run();
    });

    it("requires super_admin role", async () => {
      const { sessionToken: userToken } = await (await import("./helpers")).createTestUser(env.DB);
      const res = await SELF.fetch("http://localhost/api/admin/versions/ptu", {
        method: "DELETE",
        headers: {
          ...(await authHeaders(userToken)),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel: "PTU" }),
      });
      expect(res.status).toBe(403);
    });

    it("returns 404 for non-existent channel", async () => {
      const res = await SELF.fetch("http://localhost/api/admin/versions/ptu", {
        method: "DELETE",
        headers: {
          ...(await authHeaders(adminToken)),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel: "EPTU" }),
      });
      expect(res.status).toBe(404);
    });

    it("purges PTU data and preserves LIVE data", async () => {
      // Verify PTU data exists
      const ptuBefore = await env.DB
        .prepare("SELECT COUNT(*) as cnt FROM vehicles WHERE game_version_id = ?")
        .bind(ptuVersionId)
        .first<{ cnt: number }>();
      expect(ptuBefore!.cnt).toBeGreaterThan(0);

      // Verify LIVE data exists
      const liveBefore = await env.DB
        .prepare("SELECT COUNT(*) as cnt FROM vehicles WHERE game_version_id = ?")
        .bind(liveVersionId)
        .first<{ cnt: number }>();
      expect(liveBefore!.cnt).toBeGreaterThan(0);

      // Purge PTU
      const res = await SELF.fetch("http://localhost/api/admin/versions/ptu", {
        method: "DELETE",
        headers: {
          ...(await authHeaders(adminToken)),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel: "PTU" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; tables_purged: number; channel: string };
      expect(body.ok).toBe(true);
      expect(body.channel).toBe("PTU");
      expect(body.tables_purged).toBeGreaterThan(0);

      // Verify PTU data is gone
      const ptuAfter = await env.DB
        .prepare("SELECT COUNT(*) as cnt FROM vehicles WHERE game_version_id = ?")
        .bind(ptuVersionId)
        .first<{ cnt: number }>();
      expect(ptuAfter!.cnt).toBe(0);

      const ptuMfr = await env.DB
        .prepare("SELECT COUNT(*) as cnt FROM manufacturers WHERE game_version_id = ?")
        .bind(ptuVersionId)
        .first<{ cnt: number }>();
      expect(ptuMfr!.cnt).toBe(0);

      // Verify LIVE data is preserved
      const liveAfter = await env.DB
        .prepare("SELECT COUNT(*) as cnt FROM vehicles WHERE game_version_id = ?")
        .bind(liveVersionId)
        .first<{ cnt: number }>();
      expect(liveAfter!.cnt).toBe(liveBefore!.cnt);

      // Verify build_number was cleared
      const ptuVersion = await env.DB
        .prepare("SELECT build_number FROM game_versions WHERE id = ?")
        .bind(ptuVersionId)
        .first<{ build_number: string | null }>();
      expect(ptuVersion!.build_number).toBeNull();
    });

    it("PTU version hidden from /api/patches after purge (no data = not shown)", async () => {
      // Purge PTU
      await SELF.fetch("http://localhost/api/admin/versions/ptu", {
        method: "DELETE",
        headers: {
          ...(await authHeaders(adminToken)),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel: "PTU" }),
      });

      const res = await SELF.fetch("http://localhost/api/patches");
      expect(res.status).toBe(200);
      const versions = (await res.json()) as { code: string; channel: string }[];
      const ptuEntry = versions.find((v) => v.channel === "PTU");
      expect(ptuEntry, "PTU should not appear in patches list after purge").toBeUndefined();
    });
  });

  describe("build update endpoint (PUT /api/admin/versions/ptu/build)", () => {
    beforeEach(async () => {
      // Ensure PTU version exists
      await env.DB
        .prepare(
          "INSERT OR IGNORE INTO game_versions (uuid, code, channel, is_default, build_number) VALUES ('ptu-test-uuid', '4.7.0-ptu', 'PTU', 0, '12345678')"
        )
        .run();
    });

    it("updates build number", async () => {
      const res = await SELF.fetch("http://localhost/api/admin/versions/ptu/build", {
        method: "PUT",
        headers: {
          ...(await authHeaders(adminToken)),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel: "PTU", build_number: "99999999" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; build_number: string };
      expect(body.ok).toBe(true);
      expect(body.build_number).toBe("99999999");

      // Verify in DB
      const row = await env.DB
        .prepare("SELECT build_number FROM game_versions WHERE channel = 'PTU'")
        .first<{ build_number: string }>();
      expect(row!.build_number).toBe("99999999");
    });

    it("updates code when provided", async () => {
      const res = await SELF.fetch("http://localhost/api/admin/versions/ptu/build", {
        method: "PUT",
        headers: {
          ...(await authHeaders(adminToken)),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel: "PTU", build_number: "99999999", code: "4.8.0-ptu" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; code: string };
      expect(body.code).toBe("4.8.0-ptu");
    });
  });
});
