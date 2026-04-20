/**
 * POI detail endpoint — `/api/gamedata/poi/:slug`.
 *
 * Two integration cases:
 *   1. Data-rich: seed a location with shops + loot pool + missions + siblings,
 *      assert each section envelope renders with expected counts.
 *   2. Empty-state: seed only a location row with no shops/loot/missions,
 *      assert the response still renders (no 404) with zero counts.
 *
 * Plus one slug-alias case: request the container-side slug ("FloatingIslands")
 * and confirm it resolves to the canonical star_map_locations row.
 *
 * See plan: /home/gavin/.claude/plans/curious-popping-toucan.md
 */
import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { setupTestDatabase, TEST_GAME_VERSION_ID } from "./apply-migrations";

async function seedPOIFixtures(db: D1Database) {
  // Orison — data-rich POI
  await db.batch([
    db.prepare(
      `INSERT INTO star_map_locations (uuid, name, slug, location_type, parent_uuid, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind("sml-crusader", "Crusader", "starmapobject.stanton2", "unknown", null, TEST_GAME_VERSION_ID),
    db.prepare(
      `INSERT INTO star_map_locations (uuid, name, slug, location_type, parent_uuid, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind("sml-orison", "Orison", "stanton2-orison", "unknown", "sml-crusader", TEST_GAME_VERSION_ID),
    db.prepare(
      `INSERT INTO star_map_locations (uuid, name, slug, location_type, parent_uuid, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind("sml-island", "Floating Islands", "floatingisland-clusterparent", "unknown", "sml-crusader", TEST_GAME_VERSION_ID),
    // Empty POI — exists but has no shops/loot/missions
    db.prepare(
      `INSERT INTO star_map_locations (uuid, name, slug, location_type, parent_uuid, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind("sml-ghost", "Ghost Station", "ghost-station", "station", "sml-crusader", TEST_GAME_VERSION_ID),
  ]);

  // Shops at Orison — real UEX-tagged
  await db.batch([
    db.prepare(
      `INSERT INTO shops (uuid, name, slug, shop_type, is_event, location_label, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind("sh-1", "Ellroys", "ellroys", "general", 0, "Orison", TEST_GAME_VERSION_ID),
    db.prepare(
      `INSERT INTO shops (uuid, name, slug, shop_type, is_event, location_label, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind("sh-2", "Whammers", "whammers", "general", 0, "Orison", TEST_GAME_VERSION_ID),
    // Admin shop — should be filtered out
    db.prepare(
      `INSERT INTO shops (uuid, name, slug, shop_type, is_event, location_label, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind("sh-admin", "AdminOffice Orison", "admin-orison", "admin", 0, "Orison", TEST_GAME_VERSION_ID),
    // Container-rooted — should be filtered out
    db.prepare(
      `INSERT INTO shops (uuid, name, slug, shop_type, is_event, location_label, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind("sh-ooc", "Stanton", "stanton-routing", "general", 0, "Orison", TEST_GAME_VERSION_ID),
  ]);

  const shops = await db.prepare("SELECT id, uuid FROM shops").all();
  const ellroys = (shops.results.find((s: any) => s.uuid === "sh-1") as any).id as number;

  // One terminal + item for Ellroys so item_count > 0
  await db.prepare(
    `INSERT INTO terminals (uuid, shop_id, shop_name_key, terminal_type, game_version_id)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind("term-ellroys", ellroys, "SCShop_Ellroys", "item", TEST_GAME_VERSION_ID).run();

  const terminal = (await db.prepare("SELECT id FROM terminals WHERE uuid='term-ellroys'").first()) as any;
  await db.prepare(
    `INSERT INTO terminal_inventory (terminal_id, item_uuid, item_name, latest_buy_price, latest_sell_price, latest_source, latest_observed_at, base_inventory, max_inventory, game_version_id)
     VALUES (?, ?, ?, ?, ?, 'uex', datetime('now'), ?, ?, ?)`,
  ).bind(terminal.id, "item-boop", "BoopGun", 4200, null, 10, 30, TEST_GAME_VERSION_ID).run();

  // Loot pool at Floating Islands (container slug)
  await db.batch([
    db.prepare(
      `INSERT INTO loot_map (uuid, name, class_name, category, game_version_id)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind("lm-bullet", "Generic Bullet", "bullet_1", "ammo", TEST_GAME_VERSION_ID),
    db.prepare(
      `INSERT INTO loot_map (uuid, name, class_name, category, game_version_id)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind("lm-medpen", "Medical Pen", "medpen_1", "consumable", TEST_GAME_VERSION_ID),
  ]);

  const lmBullet = (await db.prepare("SELECT id FROM loot_map WHERE uuid='lm-bullet'").first()) as any;
  const lmMed = (await db.prepare("SELECT id FROM loot_map WHERE uuid='lm-medpen'").first()) as any;

  await db.batch([
    db.prepare(
      `INSERT INTO loot_item_locations (loot_map_id, game_version_id, source_type, location_key, container_type, per_roll, rolls, loot_table, location_label, data_source)
       VALUES (?, ?, 'container', ?, ?, ?, ?, ?, ?, 'p4k')`,
    ).bind(lmBullet.id, TEST_GAME_VERSION_ID, "FloatingIslands", "AmmoCrate_Small", 0.01, 5, "LootTable.GeneralLoot_AmmoAndMedics", "Zone A"),
    db.prepare(
      `INSERT INTO loot_item_locations (loot_map_id, game_version_id, source_type, location_key, container_type, per_roll, rolls, loot_table, location_label, data_source)
       VALUES (?, ?, 'container', ?, ?, ?, ?, ?, ?, 'p4k')`,
    ).bind(lmMed.id, TEST_GAME_VERSION_ID, "FloatingIslands", "AmmoCrate_Small", 0.02, 5, "LootTable.GeneralLoot_AmmoAndMedics", "Zone A"),
  ]);

  // Mission at Orison via location_ref (primary match)
  await db.prepare(
    `INSERT INTO missions (uuid, name, title, slug, location_ref, is_lawful, game_version_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind("m-orison-1", "Rescue the Mayor", "Rescue the Mayor", "rescue-mayor", "stanton2-orison", 1, TEST_GAME_VERSION_ID).run();
}

describe("POI detail — /api/gamedata/poi/:slug", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    await seedPOIFixtures(env.DB);
  });

  describe("canonical slug (data-rich POI)", () => {
    it("returns populated shape for Orison", async () => {
      const res = await SELF.fetch("http://localhost/api/gamedata/poi/stanton2-orison");
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;

      expect(data.location.canonical_slug).toBe("stanton2-orison");
      expect(data.location.name).toBe("Orison");
      expect(data.location.hierarchy).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "Crusader" })]),
      );
    });

    it("shops section filters admin + container-rooted shops", async () => {
      const res = await SELF.fetch("http://localhost/api/gamedata/poi/stanton2-orison");
      const data = (await res.json()) as any;

      expect(data.shops.partial).toBe(false);
      // Ellroys + Whammers survive; admin + container-routed "Stanton" are filtered.
      expect(data.shops.count).toBe(2);
      const names = data.shops.data.map((s: any) => s.name).sort();
      expect(names).toEqual(["Ellroys", "Whammers"]);
      // Ellroys has 1 UEX item, Whammers has 0
      const ellroys = data.shops.data.find((s: any) => s.name === "Ellroys");
      expect(ellroys.item_count).toBe(1);
      expect(ellroys.has_uex_data).toBe(true);
    });

    it("missions section surfaces location_ref matches", async () => {
      const res = await SELF.fetch("http://localhost/api/gamedata/poi/stanton2-orison");
      const data = (await res.json()) as any;

      expect(data.missions.partial).toBe(false);
      expect(data.missions.count).toBeGreaterThanOrEqual(1);
      const rescue = data.missions.data.find((m: any) => m.title === "Rescue the Mayor");
      expect(rescue).toBeDefined();
      expect(rescue.likely).toBe(false); // matched via location_ref, not fallback
    });
  });

  describe("alias slug", () => {
    it("resolves FloatingIslands to Orison (via LOCATION_SLUG_MAP) and returns its loot pool", async () => {
      const res = await SELF.fetch("http://localhost/api/gamedata/poi/FloatingIslands");
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;

      // Canonical resolves to Orison
      expect(data.location.canonical_slug).toBe("stanton2-orison");
      // Loot pool comes from the container slug
      expect(data.loot_pools.partial).toBe(false);
      expect(data.loot_pools.count).toBe(1);
      expect(data.loot_pools.data[0].loot_table).toBe("LootTable.GeneralLoot_AmmoAndMedics");
      expect(data.loot_pools.data[0].rolls).toBe(5);
      expect(data.loot_pools.data[0].items.length).toBe(2);
      // per_container_odds is computed from 1 - (1 - per_roll)^rolls
      const bullet = data.loot_pools.data[0].items.find((i: any) => i.name === "Generic Bullet");
      expect(bullet.per_container_odds).toBeCloseTo(1 - Math.pow(1 - 0.01, 5), 4);
    });
  });

  describe("fuzzy slug (F118)", () => {
    it("resolves mixed-case input via case-insensitive match", async () => {
      const res = await SELF.fetch("http://localhost/api/gamedata/poi/Stanton2-Orison");
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.location.canonical_slug).toBe("stanton2-orison");
    });

    it("resolves normalized slug via stripped-non-alphanum match", async () => {
      // "orison" matches "stanton2-orison" via suffix-normalized lookup
      const res = await SELF.fetch("http://localhost/api/gamedata/poi/orison");
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.location.canonical_slug).toBe("stanton2-orison");
    });
  });

  describe("empty-state POI", () => {
    it("renders location + zero-count sections rather than 404ing", async () => {
      const res = await SELF.fetch("http://localhost/api/gamedata/poi/ghost-station");
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;

      expect(data.location.name).toBe("Ghost Station");
      expect(data.shops.count).toBe(0);
      expect(data.loot_pools.count).toBe(0);
      expect(data.missions.count).toBe(0);
    });
  });

  describe("unknown slug", () => {
    it("returns 404 when slug doesn't resolve", async () => {
      const res = await SELF.fetch("http://localhost/api/gamedata/poi/this-slug-does-not-exist");
      expect(res.status).toBe(404);
    });
  });

  describe("npc_factions (stubbed)", () => {
    it("renders a partial envelope with the index-deferred note", async () => {
      const res = await SELF.fetch("http://localhost/api/gamedata/poi/stanton2-orison");
      const data = (await res.json()) as any;

      expect(data.npc_factions.partial).toBe(true);
      expect(data.npc_factions.count).toBe(0);
      expect(data.npc_factions.note).toContain("not yet indexed");
    });
  });
});
