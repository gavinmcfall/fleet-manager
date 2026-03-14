import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { setupTestDatabase } from "./apply-migrations";
import { createTestUser, createAdminUser, seedVehicle } from "./helpers";

/**
 * GDPR Cascade Tests
 *
 * Verifies that deleting a user cascades to ALL user-owned tables.
 * Every user_* table MUST have ON DELETE CASCADE from user(id).
 *
 * If a new user_* table is added without CASCADE, these tests MUST fail.
 */

/**
 * Delete a user and all Better Auth-managed tables that block FK deletion.
 * Better Auth's session/account/member tables have REFERENCES user(id)
 * but NO CASCADE — we must clean them manually before deleting the user.
 */
async function deleteUserFull(db: D1Database, userId: string): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM "session" WHERE userId = ?').bind(userId),
    db.prepare('DELETE FROM "account" WHERE userId = ?').bind(userId),
    db.prepare('DELETE FROM "member" WHERE userId = ?').bind(userId),
    db.prepare('DELETE FROM "user" WHERE id = ?').bind(userId),
  ]);
}

// All user-owned tables that must cascade on user delete.
// ADD NEW USER TABLES HERE when they are created.
const USER_TABLES = [
  "user_fleet",
  "user_paints",
  "user_settings",
  "user_llm_configs",
  "user_loot_collection",
  "user_loot_wishlist",
  "user_rsi_profile",
  "user_hangar_syncs",
  "user_pledges",
  "user_pledge_items",
  "user_pledge_upgrades",
  "user_account_snapshots",
  "user_named_ships",
  // AI analyses also cascade
  "ai_analyses",
  // Change history (fixed in 0106)
  "user_change_history",
] as const;

// Tables with user_id that DON'T cascade (known exceptions).
// These must be cleaned up explicitly during account deletion.
const USER_TABLES_NO_CASCADE = [
  // None currently — all user tables cascade.
] as const;

describe("GDPR — User Deletion Cascade", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
  });

  describe("ON DELETE CASCADE — all user tables", () => {
    it("deleting a user removes all their data from every user-owned table", async () => {
      const db = env.DB;
      const user = await createTestUser(db);
      const vehicleId = await seedVehicle(db);

      // ── Seed data in every user-owned table ──

      // user_fleet
      await db
        .prepare(
          `INSERT INTO user_fleet (user_id, vehicle_id, imported_at)
           VALUES (?, ?, datetime('now'))`
        )
        .bind(user.userId, vehicleId)
        .run();

      // user_paints (need a paint first)
      await db
        .prepare("INSERT INTO paints (name, slug) VALUES ('Test Paint', 'test-paint')")
        .run();
      const paintRow = await db
        .prepare("SELECT id FROM paints WHERE slug = 'test-paint'")
        .first<{ id: number }>();
      await db
        .prepare("INSERT INTO user_paints (user_id, paint_id) VALUES (?, ?)")
        .bind(user.userId, paintRow!.id)
        .run();

      // user_settings
      await db
        .prepare(
          "INSERT INTO user_settings (user_id, key, value) VALUES (?, 'theme', 'dark')"
        )
        .bind(user.userId)
        .run();

      // user_llm_configs
      await db
        .prepare(
          `INSERT INTO user_llm_configs (user_id, provider, encrypted_api_key)
           VALUES (?, 'openai', 'enc-key-xxx')`
        )
        .bind(user.userId)
        .run();

      // user_loot_collection (need a loot item)
      await db
        .prepare(
          `INSERT INTO loot_map (uuid, name, type, sub_type, game_version_id, updated_at)
           VALUES ('loot-uuid-1', 'Test Loot', 'Weapon', 'Pistol',
             (SELECT id FROM game_versions WHERE is_default = 1), datetime('now'))`
        )
        .run();
      const lootRow = await db
        .prepare("SELECT id FROM loot_map WHERE uuid = 'loot-uuid-1'")
        .first<{ id: number }>();
      await db
        .prepare(
          "INSERT INTO user_loot_collection (user_id, loot_map_id) VALUES (?, ?)"
        )
        .bind(user.userId, lootRow!.id)
        .run();

      // user_loot_wishlist
      await db
        .prepare(
          "INSERT INTO user_loot_wishlist (user_id, loot_map_id) VALUES (?, ?)"
        )
        .bind(user.userId, lootRow!.id)
        .run();

      // user_rsi_profile
      await db
        .prepare(
          `INSERT INTO user_rsi_profile (user_id, handle)
           VALUES (?, 'TestHandle')`
        )
        .bind(user.userId)
        .run();

      // ai_analyses
      await db
        .prepare(
          `INSERT INTO ai_analyses (user_id, provider, model, vehicle_count, analysis)
           VALUES (?, 'test', 'test-model', 5, 'test analysis')`
        )
        .bind(user.userId)
        .run();

      // user_change_history (fixed in 0106 — now cascades)
      await db
        .prepare(
          `INSERT INTO user_change_history (user_id, event_type_id) VALUES (?, 14)`
        )
        .bind(user.userId)
        .run();

      // user_hangar_syncs → user_pledges → user_pledge_items + user_pledge_upgrades
      await db
        .prepare(
          `INSERT INTO user_hangar_syncs (user_id, source, pledge_count, ship_count)
           VALUES (?, 'extension', 10, 5)`
        )
        .bind(user.userId)
        .run();
      const syncRow = await db
        .prepare(
          "SELECT id FROM user_hangar_syncs WHERE user_id = ? ORDER BY id DESC LIMIT 1"
        )
        .bind(user.userId)
        .first<{ id: number }>();

      await db
        .prepare(
          `INSERT INTO user_pledges (user_id, sync_id, rsi_pledge_id, name)
           VALUES (?, ?, 12345678, 'Test Pledge - Gladius')`
        )
        .bind(user.userId, syncRow!.id)
        .run();
      const pledgeRow = await db
        .prepare(
          "SELECT id FROM user_pledges WHERE user_id = ? ORDER BY id DESC LIMIT 1"
        )
        .bind(user.userId)
        .first<{ id: number }>();

      await db
        .prepare(
          `INSERT INTO user_pledge_items (user_id, user_pledge_id, title, kind)
           VALUES (?, ?, 'Gladius', 'Ship')`
        )
        .bind(user.userId, pledgeRow!.id)
        .run();

      await db
        .prepare(
          `INSERT INTO user_pledge_upgrades (user_id, user_pledge_id, upgrade_name)
           VALUES (?, ?, 'Upgrade - Aurora to Gladius')`
        )
        .bind(user.userId, pledgeRow!.id)
        .run();

      // user_account_snapshots
      await db
        .prepare(
          `INSERT INTO user_account_snapshots (user_id, sync_id, nickname, concierge_level)
           VALUES (?, ?, 'TestNick', 'High Admiral')`
        )
        .bind(user.userId, syncRow!.id)
        .run();

      // user_named_ships
      await db
        .prepare(
          `INSERT INTO user_named_ships (user_id, sync_id, membership_id, default_name, custom_name)
           VALUES (?, ?, 12345, 'Carrack', 'Jean-Luc')`
        )
        .bind(user.userId, syncRow!.id)
        .run();

      // ── Verify all tables have data ──
      for (const table of USER_TABLES) {
        const count = await db
          .prepare(`SELECT COUNT(*) as c FROM "${table}" WHERE user_id = ?`)
          .bind(user.userId)
          .first<{ c: number }>();
        expect(count!.c, `${table} should have data before delete`).toBeGreaterThan(0);
      }

      // ── DELETE THE USER ──
      await deleteUserFull(db, user.userId);

      // ── Verify ALL user data is gone ──
      for (const table of USER_TABLES) {
        const count = await db
          .prepare(`SELECT COUNT(*) as c FROM "${table}" WHERE user_id = ?`)
          .bind(user.userId)
          .first<{ c: number }>();
        expect(count!.c, `${table} should be empty after user delete`).toBe(0);
      }

    });

    it("deleting a user does NOT affect other users' data", async () => {
      const db = env.DB;
      const user1 = await createTestUser(db);
      const user2 = await createTestUser(db);
      const vehicleId = await seedVehicle(db);

      // Seed fleet for both users
      await db
        .prepare(
          "INSERT INTO user_fleet (user_id, vehicle_id) VALUES (?, ?)"
        )
        .bind(user1.userId, vehicleId)
        .run();
      await db
        .prepare(
          "INSERT INTO user_fleet (user_id, vehicle_id) VALUES (?, ?)"
        )
        .bind(user2.userId, vehicleId)
        .run();

      // Seed sync data for both users
      for (const uid of [user1.userId, user2.userId]) {
        await db
          .prepare(
            "INSERT INTO user_hangar_syncs (user_id, source) VALUES (?, 'extension')"
          )
          .bind(uid)
          .run();
        const syncRow = await db
          .prepare("SELECT id FROM user_hangar_syncs WHERE user_id = ?")
          .bind(uid)
          .first<{ id: number }>();
        await db
          .prepare(
            "INSERT INTO user_pledges (user_id, sync_id, rsi_pledge_id, name) VALUES (?, ?, 99, 'Test')"
          )
          .bind(uid, syncRow!.id)
          .run();
      }

      // Delete user1
      await deleteUserFull(db, user1.userId);

      // User2's data should be untouched
      const fleet2 = await db
        .prepare("SELECT COUNT(*) as c FROM user_fleet WHERE user_id = ?")
        .bind(user2.userId)
        .first<{ c: number }>();
      expect(fleet2!.c).toBe(1);

      const pledges2 = await db
        .prepare("SELECT COUNT(*) as c FROM user_pledges WHERE user_id = ?")
        .bind(user2.userId)
        .first<{ c: number }>();
      expect(pledges2!.c).toBe(1);
    });

    it("cascade chain: deleting user → syncs → pledges → items + upgrades", async () => {
      const db = env.DB;
      const user = await createTestUser(db);

      // Create sync → pledge → items + upgrades (deep chain)
      await db
        .prepare(
          "INSERT INTO user_hangar_syncs (user_id, source) VALUES (?, 'extension')"
        )
        .bind(user.userId)
        .run();
      const syncRow = await db
        .prepare("SELECT id FROM user_hangar_syncs WHERE user_id = ? ORDER BY id DESC LIMIT 1")
        .bind(user.userId)
        .first<{ id: number }>();

      await db
        .prepare(
          "INSERT INTO user_pledges (user_id, sync_id, rsi_pledge_id, name) VALUES (?, ?, 555, 'Deep Chain Pledge')"
        )
        .bind(user.userId, syncRow!.id)
        .run();
      const pledgeRow = await db
        .prepare("SELECT id FROM user_pledges WHERE user_id = ? ORDER BY id DESC LIMIT 1")
        .bind(user.userId)
        .first<{ id: number }>();

      // Multiple items under one pledge
      for (let i = 0; i < 3; i++) {
        await db
          .prepare(
            "INSERT INTO user_pledge_items (user_id, user_pledge_id, title, kind) VALUES (?, ?, ?, 'Ship')"
          )
          .bind(user.userId, pledgeRow!.id, `Ship ${i}`)
          .run();
      }

      // Multiple upgrades under one pledge
      for (let i = 0; i < 4; i++) {
        await db
          .prepare(
            "INSERT INTO user_pledge_upgrades (user_id, user_pledge_id, upgrade_name, sort_order) VALUES (?, ?, ?, ?)"
          )
          .bind(user.userId, pledgeRow!.id, `Upgrade ${i}`, i)
          .run();
      }

      // Verify deep data exists
      const items = await db
        .prepare("SELECT COUNT(*) as c FROM user_pledge_items WHERE user_id = ?")
        .bind(user.userId)
        .first<{ c: number }>();
      expect(items!.c).toBe(3);

      const upgrades = await db
        .prepare("SELECT COUNT(*) as c FROM user_pledge_upgrades WHERE user_id = ?")
        .bind(user.userId)
        .first<{ c: number }>();
      expect(upgrades!.c).toBe(4);

      // Delete user — everything should cascade
      await deleteUserFull(db, user.userId);

      // Verify deep chain is clean
      for (const table of [
        "user_hangar_syncs",
        "user_pledges",
        "user_pledge_items",
        "user_pledge_upgrades",
        "user_account_snapshots",
        "user_named_ships",
      ]) {
        const count = await db
          .prepare(`SELECT COUNT(*) as c FROM "${table}" WHERE user_id = ?`)
          .bind(user.userId)
          .first<{ c: number }>();
        expect(count!.c, `${table} should be empty after cascade`).toBe(0);
      }
    });
  });

  describe("Sync cascade — deleting a sync removes child data", () => {
    it("deleting a sync cascades to pledges, items, upgrades, snapshots, named ships", async () => {
      const db = env.DB;
      const user = await createTestUser(db);

      // Create sync with children
      await db
        .prepare(
          "INSERT INTO user_hangar_syncs (user_id, source) VALUES (?, 'extension')"
        )
        .bind(user.userId)
        .run();
      const syncRow = await db
        .prepare("SELECT id FROM user_hangar_syncs WHERE user_id = ? ORDER BY id DESC LIMIT 1")
        .bind(user.userId)
        .first<{ id: number }>();
      const syncId = syncRow!.id;

      await db
        .prepare(
          "INSERT INTO user_pledges (user_id, sync_id, rsi_pledge_id, name) VALUES (?, ?, 777, 'Sync Cascade Test')"
        )
        .bind(user.userId, syncId)
        .run();
      const pledgeRow = await db
        .prepare("SELECT id FROM user_pledges WHERE user_id = ? ORDER BY id DESC LIMIT 1")
        .bind(user.userId)
        .first<{ id: number }>();

      await db
        .prepare(
          "INSERT INTO user_pledge_items (user_id, user_pledge_id, title, kind) VALUES (?, ?, 'Test Ship', 'Ship')"
        )
        .bind(user.userId, pledgeRow!.id)
        .run();

      await db
        .prepare(
          "INSERT INTO user_account_snapshots (user_id, sync_id, nickname) VALUES (?, ?, 'Nick')"
        )
        .bind(user.userId, syncId)
        .run();

      await db
        .prepare(
          "INSERT INTO user_named_ships (user_id, sync_id, membership_id, default_name, custom_name) VALUES (?, ?, 999, 'Idris', 'Enterprise')"
        )
        .bind(user.userId, syncId)
        .run();

      // Delete the sync (not the user)
      await db.prepare("DELETE FROM user_hangar_syncs WHERE id = ?").bind(syncId).run();

      // Pledges, items, snapshots, named ships should cascade
      const pledges = await db
        .prepare("SELECT COUNT(*) as c FROM user_pledges WHERE sync_id = ?")
        .bind(syncId)
        .first<{ c: number }>();
      expect(pledges!.c).toBe(0);

      const snapshots = await db
        .prepare("SELECT COUNT(*) as c FROM user_account_snapshots WHERE sync_id = ?")
        .bind(syncId)
        .first<{ c: number }>();
      expect(snapshots!.c).toBe(0);

      const ships = await db
        .prepare("SELECT COUNT(*) as c FROM user_named_ships WHERE sync_id = ?")
        .bind(syncId)
        .first<{ c: number }>();
      expect(ships!.c).toBe(0);

      // User still exists
      const userExists = await db
        .prepare('SELECT COUNT(*) as c FROM "user" WHERE id = ?')
        .bind(user.userId)
        .first<{ c: number }>();
      expect(userExists!.c).toBe(1);
    });
  });

  describe("Pledge cascade — deleting a pledge removes items and upgrades", () => {
    it("deleting a pledge cascades to items and upgrades", async () => {
      const db = env.DB;
      const user = await createTestUser(db);

      await db
        .prepare(
          "INSERT INTO user_hangar_syncs (user_id, source) VALUES (?, 'extension')"
        )
        .bind(user.userId)
        .run();
      const syncRow = await db
        .prepare("SELECT id FROM user_hangar_syncs WHERE user_id = ? ORDER BY id DESC LIMIT 1")
        .bind(user.userId)
        .first<{ id: number }>();

      await db
        .prepare(
          "INSERT INTO user_pledges (user_id, sync_id, rsi_pledge_id, name) VALUES (?, ?, 888, 'Pledge Cascade')"
        )
        .bind(user.userId, syncRow!.id)
        .run();
      const pledgeRow = await db
        .prepare("SELECT id FROM user_pledges WHERE user_id = ? ORDER BY id DESC LIMIT 1")
        .bind(user.userId)
        .first<{ id: number }>();
      const pledgeId = pledgeRow!.id;

      // Add items + upgrades
      await db
        .prepare(
          "INSERT INTO user_pledge_items (user_id, user_pledge_id, title, kind) VALUES (?, ?, 'Carrack', 'Ship')"
        )
        .bind(user.userId, pledgeId)
        .run();
      await db
        .prepare(
          "INSERT INTO user_pledge_items (user_id, user_pledge_id, title, kind) VALUES (?, ?, 'LTI', 'Insurance')"
        )
        .bind(user.userId, pledgeId)
        .run();
      await db
        .prepare(
          "INSERT INTO user_pledge_upgrades (user_id, user_pledge_id, upgrade_name) VALUES (?, ?, 'Aurora to Carrack')"
        )
        .bind(user.userId, pledgeId)
        .run();

      // Delete just the pledge
      await db.prepare("DELETE FROM user_pledges WHERE id = ?").bind(pledgeId).run();

      // Items and upgrades should be gone
      const items = await db
        .prepare("SELECT COUNT(*) as c FROM user_pledge_items WHERE user_pledge_id = ?")
        .bind(pledgeId)
        .first<{ c: number }>();
      expect(items!.c).toBe(0);

      const upgrades = await db
        .prepare("SELECT COUNT(*) as c FROM user_pledge_upgrades WHERE user_pledge_id = ?")
        .bind(pledgeId)
        .first<{ c: number }>();
      expect(upgrades!.c).toBe(0);

      // Sync and user still exist
      const syncs = await db
        .prepare("SELECT COUNT(*) as c FROM user_hangar_syncs WHERE user_id = ?")
        .bind(user.userId)
        .first<{ c: number }>();
      expect(syncs!.c).toBe(1);
    });
  });

  describe("Platform data is NOT deleted when user is deleted", () => {
    it("rsi_media survives user deletion", async () => {
      const db = env.DB;
      const user = await createTestUser(db);

      // Insert platform data
      await db
        .prepare(
          "INSERT INTO rsi_media (slug, filename, source_extension, cdn_format) VALUES ('test-slug-1', 'test', 'jpg', 'old')"
        )
        .run();

      // Link it to user data
      const mediaRow = await db
        .prepare("SELECT id FROM rsi_media WHERE slug = 'test-slug-1'")
        .first<{ id: number }>();

      await db
        .prepare(
          "INSERT INTO user_hangar_syncs (user_id, source) VALUES (?, 'extension')"
        )
        .bind(user.userId)
        .run();
      const syncRow = await db
        .prepare("SELECT id FROM user_hangar_syncs WHERE user_id = ? ORDER BY id DESC LIMIT 1")
        .bind(user.userId)
        .first<{ id: number }>();
      await db
        .prepare(
          "INSERT INTO user_pledges (user_id, sync_id, rsi_pledge_id, name) VALUES (?, ?, 111, 'Media Test')"
        )
        .bind(user.userId, syncRow!.id)
        .run();
      const pledgeRow = await db
        .prepare("SELECT id FROM user_pledges WHERE user_id = ? ORDER BY id DESC LIMIT 1")
        .bind(user.userId)
        .first<{ id: number }>();
      await db
        .prepare(
          "INSERT INTO user_pledge_items (user_id, user_pledge_id, title, kind, rsi_media_id) VALUES (?, ?, 'Test', 'Ship', ?)"
        )
        .bind(user.userId, pledgeRow!.id, mediaRow!.id)
        .run();

      // Delete user
      await deleteUserFull(db, user.userId);

      // Platform data should survive
      const media = await db
        .prepare("SELECT COUNT(*) as c FROM rsi_media WHERE slug = 'test-slug-1'")
        .first<{ c: number }>();
      expect(media!.c).toBe(1);
    });

    it("rsi_entity_mappings survive user deletion", async () => {
      const db = env.DB;
      const admin = await createAdminUser(db);

      // Create a mapping approved by admin
      await db
        .prepare(
          `INSERT INTO rsi_entity_mappings (rsi_name, rsi_kind, reviewed_at, reviewed_by)
           VALUES ('Hurricane', 'Ship', datetime('now'), ?)`
        )
        .bind(admin.userId)
        .run();

      // Delete the admin
      await deleteUserFull(db, admin.userId);

      // Mapping should survive (reviewed_by is not CASCADE)
      const mapping = await db
        .prepare("SELECT COUNT(*) as c FROM rsi_entity_mappings WHERE rsi_name = 'Hurricane'")
        .first<{ c: number }>();
      expect(mapping!.c).toBe(1);
    });

    it("rsi_staging_items survive user deletion", async () => {
      const db = env.DB;
      const user = await createTestUser(db);

      await db
        .prepare(
          "INSERT INTO rsi_staging_items (name, kind, source_user_id) VALUES ('New Ship', 'Ship', ?)"
        )
        .bind(user.userId)
        .run();

      // Delete user
      await deleteUserFull(db, user.userId);

      // Staging item should survive (source_user_id is informational, not a FK)
      const staging = await db
        .prepare("SELECT COUNT(*) as c FROM rsi_staging_items WHERE name = 'New Ship'")
        .first<{ c: number }>();
      expect(staging!.c).toBe(1);
    });
  });

  describe("Schema completeness — all user tables are tracked", () => {
    it("USER_TABLES list matches all tables with user_id column", async () => {
      const db = env.DB;

      // Get all tables that have a user_id column
      const tables = await db
        .prepare(
          `SELECT m.name as table_name
           FROM sqlite_master m
           WHERE m.type = 'table'
             AND m.name NOT LIKE 'sqlite_%'
             AND m.name NOT LIKE 'd1_%'
             AND m.name NOT LIKE '_cf_%'
           ORDER BY m.name`
        )
        .all<{ table_name: string }>();

      const tablesWithUserId: string[] = [];
      for (const { table_name } of tables.results) {
        const cols = await db
          .prepare(`PRAGMA table_info("${table_name}")`)
          .all<{ name: string }>();
        const hasUserId = cols.results.some((c) => c.name === "user_id");
        if (hasUserId) {
          tablesWithUserId.push(table_name);
        }
      }

      // Every table with a user_id column must be in USER_TABLES or USER_TABLES_NO_CASCADE
      const tracked = new Set([...USER_TABLES, ...USER_TABLES_NO_CASCADE]);
      const untracked = tablesWithUserId.filter((t) => !tracked.has(t));

      expect(
        untracked,
        `Found user_id tables NOT in USER_TABLES or USER_TABLES_NO_CASCADE — add them to ensure GDPR coverage: ${untracked.join(", ")}`
      ).toEqual([]);
    });
  });
});
