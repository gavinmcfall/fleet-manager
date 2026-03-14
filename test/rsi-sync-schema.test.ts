import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { setupTestDatabase } from "./apply-migrations";
import { createTestUser, createAdminUser, seedVehicle } from "./helpers";

/**
 * RSI Sync Schema Tests
 *
 * Validates the 0105 migration tables: structure, constraints,
 * indexes, and data integrity rules.
 */

describe("RSI Sync Schema — Migration 0105", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
  });

  // ─── Insurance Types ───

  describe("insurance_types — new entries", () => {
    it("has 60-month insurance type", async () => {
      const row = await env.DB
        .prepare("SELECT * FROM insurance_types WHERE key = '60_month'")
        .first();
      expect(row).toBeDefined();
      expect(row!.duration_months).toBe(60);
      expect(row!.is_lifetime).toBe(0);
    });

    it("has 2-month insurance type", async () => {
      const row = await env.DB
        .prepare("SELECT * FROM insurance_types WHERE key = '2_month'")
        .first();
      expect(row).toBeDefined();
      expect(row!.duration_months).toBe(2);
      expect(row!.is_lifetime).toBe(0);
    });

    it("has all 9 insurance types", async () => {
      const result = await env.DB
        .prepare("SELECT COUNT(*) as c FROM insurance_types")
        .first<{ c: number }>();
      expect(result!.c).toBe(9);
    });
  });

  // ─── rsi_media ───

  describe("rsi_media", () => {
    it("enforces unique slug", async () => {
      const db = env.DB;
      await db
        .prepare(
          "INSERT INTO rsi_media (slug, filename, source_extension, cdn_format) VALUES ('unique-test', 'file', 'jpg', 'old')"
        )
        .run();

      await expect(
        db
          .prepare(
            "INSERT INTO rsi_media (slug, filename, source_extension, cdn_format) VALUES ('unique-test', 'other', 'png', 'new')"
          )
          .run()
      ).rejects.toThrow();
    });

    it("defaults timestamps to now", async () => {
      const db = env.DB;
      await db
        .prepare(
          "INSERT INTO rsi_media (slug, cdn_format) VALUES ('ts-test', 'old')"
        )
        .run();
      const row = await db
        .prepare("SELECT first_seen_at, last_seen_at FROM rsi_media WHERE slug = 'ts-test'")
        .first();
      expect(row!.first_seen_at).toBeTruthy();
      expect(row!.last_seen_at).toBeTruthy();
    });

    it("allows null cf_image fields until uploaded", async () => {
      const db = env.DB;
      await db
        .prepare(
          "INSERT INTO rsi_media (slug, cdn_format) VALUES ('no-cf', 'old')"
        )
        .run();
      const row = await db
        .prepare("SELECT cf_image_id, cf_image_url FROM rsi_media WHERE slug = 'no-cf'")
        .first();
      expect(row!.cf_image_id).toBeNull();
      expect(row!.cf_image_url).toBeNull();
    });
  });

  // ─── vehicle_rsi_meta ───

  describe("vehicle_rsi_meta", () => {
    it("links to vehicles with unique constraint", async () => {
      const db = env.DB;
      const vehicleId = await seedVehicle(db, { slug: "vrm-test", name: "VRM Test" });

      await db
        .prepare("INSERT INTO vehicle_rsi_meta (vehicle_id, rsi_ship_id) VALUES (?, 42)")
        .bind(vehicleId)
        .run();

      // Duplicate vehicle_id should fail
      await expect(
        db
          .prepare("INSERT INTO vehicle_rsi_meta (vehicle_id, rsi_ship_id) VALUES (?, 43)")
          .bind(vehicleId)
          .run()
      ).rejects.toThrow();
    });

    it("cascades on vehicle delete", async () => {
      const db = env.DB;
      const vehicleId = await seedVehicle(db, { slug: "vrm-cascade", name: "VRM Cascade" });

      await db
        .prepare("INSERT INTO vehicle_rsi_meta (vehicle_id, rsi_ship_id) VALUES (?, 99)")
        .bind(vehicleId)
        .run();

      // Delete vehicle
      await db.prepare("DELETE FROM vehicles WHERE id = ?").bind(vehicleId).run();

      const meta = await db
        .prepare("SELECT COUNT(*) as c FROM vehicle_rsi_meta WHERE vehicle_id = ?")
        .bind(vehicleId)
        .first<{ c: number }>();
      expect(meta!.c).toBe(0);
    });
  });

  // ─── paint_rsi_meta ───

  describe("paint_rsi_meta", () => {
    it("links to paints with unique constraint", async () => {
      const db = env.DB;
      await db
        .prepare("INSERT INTO paints (name, slug) VALUES ('PRM Test Paint', 'prm-test-paint')")
        .run();
      const paintRow = await db
        .prepare("SELECT id FROM paints WHERE slug = 'prm-test-paint'")
        .first<{ id: number }>();

      await db
        .prepare("INSERT INTO paint_rsi_meta (paint_id) VALUES (?)")
        .bind(paintRow!.id)
        .run();

      // Duplicate should fail
      await expect(
        db
          .prepare("INSERT INTO paint_rsi_meta (paint_id) VALUES (?)")
          .bind(paintRow!.id)
          .run()
      ).rejects.toThrow();
    });
  });

  // ─── rsi_entity_mappings ───

  describe("rsi_entity_mappings", () => {
    it("enforces unique (rsi_name, rsi_kind)", async () => {
      const db = env.DB;
      await db
        .prepare(
          "INSERT INTO rsi_entity_mappings (rsi_name, rsi_kind) VALUES ('Hurricane', 'Ship')"
        )
        .run();

      await expect(
        db
          .prepare(
            "INSERT INTO rsi_entity_mappings (rsi_name, rsi_kind) VALUES ('Hurricane', 'Ship')"
          )
          .run()
      ).rejects.toThrow();
    });

    it("allows same name with different kind", async () => {
      const db = env.DB;
      await db
        .prepare(
          "INSERT INTO rsi_entity_mappings (rsi_name, rsi_kind) VALUES ('Stormcloud', 'Skin')"
        )
        .run();
      await db
        .prepare(
          "INSERT INTO rsi_entity_mappings (rsi_name, rsi_kind) VALUES ('Stormcloud', 'Component')"
        )
        .run();

      const count = await db
        .prepare("SELECT COUNT(*) as c FROM rsi_entity_mappings WHERE rsi_name = 'Stormcloud'")
        .first<{ c: number }>();
      expect(count!.c).toBe(2);
    });

    it("tracks review status", async () => {
      const db = env.DB;
      const admin = await createAdminUser(db);

      await db
        .prepare(
          "INSERT INTO rsi_entity_mappings (rsi_name, rsi_kind) VALUES ('Pending Ship', 'Ship')"
        )
        .run();

      // Initially unreviewed
      const pending = await db
        .prepare(
          "SELECT reviewed_at FROM rsi_entity_mappings WHERE rsi_name = 'Pending Ship'"
        )
        .first();
      expect(pending!.reviewed_at).toBeNull();

      // Approve it
      await db
        .prepare(
          `UPDATE rsi_entity_mappings
           SET reviewed_at = datetime('now'), reviewed_by = ?, entity_table = 'vehicles', entity_id = 1
           WHERE rsi_name = 'Pending Ship'`
        )
        .bind(admin.userId)
        .run();

      const approved = await db
        .prepare(
          "SELECT reviewed_at, reviewed_by, entity_table FROM rsi_entity_mappings WHERE rsi_name = 'Pending Ship'"
        )
        .first();
      expect(approved!.reviewed_at).toBeTruthy();
      expect(approved!.reviewed_by).toBe(admin.userId);
      expect(approved!.entity_table).toBe("vehicles");
    });
  });

  // ─── rsi_staging_items ───

  describe("rsi_staging_items", () => {
    it("enforces unique (name, kind)", async () => {
      const db = env.DB;
      await db
        .prepare(
          "INSERT INTO rsi_staging_items (name, kind) VALUES ('Staging Ship', 'Ship')"
        )
        .run();

      await expect(
        db
          .prepare(
            "INSERT INTO rsi_staging_items (name, kind) VALUES ('Staging Ship', 'Ship')"
          )
          .run()
      ).rejects.toThrow();
    });

    it("tracks review lifecycle", async () => {
      const db = env.DB;
      await db
        .prepare(
          "INSERT INTO rsi_staging_items (name, kind) VALUES ('Review Lifecycle', 'Ship')"
        )
        .run();

      // Promote it
      await db
        .prepare(
          `UPDATE rsi_staging_items
           SET reviewed_at = datetime('now'), review_action = 'promoted',
               promoted_to_table = 'vehicles', promoted_to_id = 1
           WHERE name = 'Review Lifecycle'`
        )
        .run();

      const row = await db
        .prepare("SELECT * FROM rsi_staging_items WHERE name = 'Review Lifecycle'")
        .first();
      expect(row!.review_action).toBe("promoted");
      expect(row!.promoted_to_table).toBe("vehicles");
    });
  });

  // ─── User Hangar Syncs ───

  describe("user_hangar_syncs", () => {
    it("creates a sync record", async () => {
      const db = env.DB;
      const user = await createTestUser(db);

      await db
        .prepare(
          "INSERT INTO user_hangar_syncs (user_id, source, pledge_count, ship_count, item_count) VALUES (?, 'extension', 100, 34, 496)"
        )
        .bind(user.userId)
        .run();

      const row = await db
        .prepare("SELECT * FROM user_hangar_syncs WHERE user_id = ?")
        .bind(user.userId)
        .first();
      expect(row!.source).toBe("extension");
      expect(row!.pledge_count).toBe(100);
      expect(row!.ship_count).toBe(34);
      expect(row!.item_count).toBe(496);
    });
  });

  // ─── User Pledges ───

  describe("user_pledges", () => {
    it("enforces unique (user_id, rsi_pledge_id)", async () => {
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
          "INSERT INTO user_pledges (user_id, sync_id, rsi_pledge_id, name) VALUES (?, ?, 12345, 'First')"
        )
        .bind(user.userId, syncRow!.id)
        .run();

      // Same rsi_pledge_id should fail
      await expect(
        db
          .prepare(
            "INSERT INTO user_pledges (user_id, sync_id, rsi_pledge_id, name) VALUES (?, ?, 12345, 'Duplicate')"
          )
          .bind(user.userId, syncRow!.id)
          .run()
      ).rejects.toThrow();
    });

    it("allows same rsi_pledge_id for different users", async () => {
      const db = env.DB;
      const user1 = await createTestUser(db);
      const user2 = await createTestUser(db);

      for (const user of [user1, user2]) {
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
            "INSERT INTO user_pledges (user_id, sync_id, rsi_pledge_id, name) VALUES (?, ?, 99999, 'Same Pledge')"
          )
          .bind(user.userId, syncRow!.id)
          .run();
      }

      const count = await db
        .prepare("SELECT COUNT(*) as c FROM user_pledges WHERE rsi_pledge_id = 99999")
        .first<{ c: number }>();
      expect(count!.c).toBe(2);
    });

    it("stores parsed values alongside raw strings", async () => {
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
          `INSERT INTO user_pledges
             (user_id, sync_id, rsi_pledge_id, name, value, value_cents,
              pledge_date, pledge_date_parsed, is_upgraded, is_reclaimable, is_giftable)
           VALUES (?, ?, 54321, 'Test Ship', '$220.00 USD', 22000,
              'August 19, 2025', '2025-08-19', 1, 1, 0)`
        )
        .bind(user.userId, syncRow!.id)
        .run();

      const row = await db
        .prepare("SELECT * FROM user_pledges WHERE rsi_pledge_id = 54321 AND user_id = ?")
        .bind(user.userId)
        .first();
      expect(row!.value).toBe("$220.00 USD");
      expect(row!.value_cents).toBe(22000);
      expect(row!.pledge_date).toBe("August 19, 2025");
      expect(row!.pledge_date_parsed).toBe("2025-08-19");
    });
  });

  // ─── User Pledge Items ───

  describe("user_pledge_items", () => {
    it("stores all item kinds", async () => {
      const db = env.DB;
      const user = await createTestUser(db);

      await db
        .prepare("INSERT INTO user_hangar_syncs (user_id, source) VALUES (?, 'extension')")
        .bind(user.userId)
        .run();
      const syncRow = await db
        .prepare("SELECT id FROM user_hangar_syncs WHERE user_id = ? ORDER BY id DESC LIMIT 1")
        .bind(user.userId)
        .first<{ id: number }>();
      await db
        .prepare(
          "INSERT INTO user_pledges (user_id, sync_id, rsi_pledge_id, name) VALUES (?, ?, 77777, 'Full Pledge')"
        )
        .bind(user.userId, syncRow!.id)
        .run();
      const pledgeRow = await db
        .prepare("SELECT id FROM user_pledges WHERE rsi_pledge_id = 77777 AND user_id = ?")
        .bind(user.userId)
        .first<{ id: number }>();

      const kinds = ["Ship", "Insurance", "Skin", "FPS Equipment", "Hangar decoration", "Component", "Credits"];
      for (const kind of kinds) {
        await db
          .prepare(
            "INSERT INTO user_pledge_items (user_id, user_pledge_id, title, kind) VALUES (?, ?, ?, ?)"
          )
          .bind(user.userId, pledgeRow!.id, `Test ${kind}`, kind)
          .run();
      }

      const count = await db
        .prepare("SELECT COUNT(*) as c FROM user_pledge_items WHERE user_pledge_id = ?")
        .bind(pledgeRow!.id)
        .first<{ c: number }>();
      expect(count!.c).toBe(kinds.length);
    });
  });

  // ─── User Pledge Upgrades ───

  describe("user_pledge_upgrades", () => {
    it("stores ordered CCU chain", async () => {
      const db = env.DB;
      const user = await createTestUser(db);

      await db
        .prepare("INSERT INTO user_hangar_syncs (user_id, source) VALUES (?, 'extension')")
        .bind(user.userId)
        .run();
      const syncRow = await db
        .prepare("SELECT id FROM user_hangar_syncs WHERE user_id = ? ORDER BY id DESC LIMIT 1")
        .bind(user.userId)
        .first<{ id: number }>();
      await db
        .prepare(
          "INSERT INTO user_pledges (user_id, sync_id, rsi_pledge_id, name, is_upgraded) VALUES (?, ?, 44444, 'CCU Chain', 1)"
        )
        .bind(user.userId, syncRow!.id)
        .run();
      const pledgeRow = await db
        .prepare("SELECT id FROM user_pledges WHERE rsi_pledge_id = 44444 AND user_id = ?")
        .bind(user.userId)
        .first<{ id: number }>();

      // Insert CCU chain (Nox → Taurus → Sabre → Carrack)
      const chain = [
        { name: "Sabre to Carrack", value_cents: 25000, order: 0 },
        { name: "Taurus to Sabre", value_cents: 17000, order: 1 },
        { name: "Nox to Taurus", value_cents: 15000, order: 2 },
      ];

      for (const ccu of chain) {
        await db
          .prepare(
            `INSERT INTO user_pledge_upgrades
               (user_id, user_pledge_id, upgrade_name, new_value_cents, sort_order)
             VALUES (?, ?, ?, ?, ?)`
          )
          .bind(user.userId, pledgeRow!.id, ccu.name, ccu.value_cents, ccu.order)
          .run();
      }

      // Verify chain order
      const upgrades = await db
        .prepare(
          "SELECT upgrade_name, sort_order FROM user_pledge_upgrades WHERE user_pledge_id = ? ORDER BY sort_order"
        )
        .bind(pledgeRow!.id)
        .all<{ upgrade_name: string; sort_order: number }>();

      expect(upgrades.results.length).toBe(3);
      expect(upgrades.results[0].upgrade_name).toBe("Sabre to Carrack");
      expect(upgrades.results[2].upgrade_name).toBe("Nox to Taurus");
    });
  });

  // ─── User Account Snapshots ───

  describe("user_account_snapshots", () => {
    it("stores point-in-time account data", async () => {
      const db = env.DB;
      const user = await createTestUser(db);

      await db
        .prepare("INSERT INTO user_hangar_syncs (user_id, source) VALUES (?, 'extension')")
        .bind(user.userId)
        .run();
      const syncRow = await db
        .prepare("SELECT id FROM user_hangar_syncs WHERE user_id = ? ORDER BY id DESC LIMIT 1")
        .bind(user.userId)
        .first<{ id: number }>();

      await db
        .prepare(
          `INSERT INTO user_account_snapshots
             (user_id, sync_id, nickname, displayname, concierge_level,
              concierge_next_level, concierge_progress,
              subscriber_type, subscriber_frequency,
              store_credit_cents, uec_balance, rec_balance,
              org_name, org_sid)
           VALUES (?, ?, 'NZVengeance', 'Calder Rhys', 'Wing Commander',
              'Praetorian', 95, 'Imperator', 'Monthly',
              0, 50000, 3613280, 'The Exelus Corporation', 'EXLS')`
        )
        .bind(user.userId, syncRow!.id)
        .run();

      const row = await db
        .prepare("SELECT * FROM user_account_snapshots WHERE user_id = ?")
        .bind(user.userId)
        .first();
      expect(row!.concierge_level).toBe("Wing Commander");
      expect(row!.subscriber_type).toBe("Imperator");
      expect(row!.rec_balance).toBe(3613280);
      expect(row!.org_sid).toBe("EXLS");
    });
  });

  // ─── User Named Ships ───

  describe("user_named_ships", () => {
    it("enforces unique (user_id, membership_id)", async () => {
      const db = env.DB;
      const user = await createTestUser(db);

      await db
        .prepare("INSERT INTO user_hangar_syncs (user_id, source) VALUES (?, 'extension')")
        .bind(user.userId)
        .run();
      const syncRow = await db
        .prepare("SELECT id FROM user_hangar_syncs WHERE user_id = ? ORDER BY id DESC LIMIT 1")
        .bind(user.userId)
        .first<{ id: number }>();

      await db
        .prepare(
          "INSERT INTO user_named_ships (user_id, sync_id, membership_id, default_name, custom_name) VALUES (?, ?, 47724581, 'Carrack', 'Jean-Luc')"
        )
        .bind(user.userId, syncRow!.id)
        .run();

      // Same membership_id for same user should fail
      await expect(
        db
          .prepare(
            "INSERT INTO user_named_ships (user_id, sync_id, membership_id, default_name, custom_name) VALUES (?, ?, 47724581, 'Carrack', 'Different Name')"
          )
          .bind(user.userId, syncRow!.id)
          .run()
      ).rejects.toThrow();
    });

    it("allows same membership_id for different users", async () => {
      const db = env.DB;
      const user1 = await createTestUser(db);
      const user2 = await createTestUser(db);

      for (const user of [user1, user2]) {
        await db
          .prepare("INSERT INTO user_hangar_syncs (user_id, source) VALUES (?, 'extension')")
          .bind(user.userId)
          .run();
        const syncRow = await db
          .prepare("SELECT id FROM user_hangar_syncs WHERE user_id = ? ORDER BY id DESC LIMIT 1")
          .bind(user.userId)
          .first<{ id: number }>();
        await db
          .prepare(
            "INSERT INTO user_named_ships (user_id, sync_id, membership_id, default_name, custom_name) VALUES (?, ?, 30521089, 'Idris', 'James Holden')"
          )
          .bind(user.userId, syncRow!.id)
          .run();
      }

      const count = await db
        .prepare("SELECT COUNT(*) as c FROM user_named_ships WHERE membership_id = 30521089")
        .first<{ c: number }>();
      expect(count!.c).toBe(2);
    });
  });

  // ─── Staging Reports ───

  describe("rsi_staging_reports", () => {
    it("stores report with email tracking", async () => {
      const db = env.DB;
      await db
        .prepare(
          `INSERT INTO rsi_staging_reports
             (report_json, new_items_count, new_media_count, new_insurance_types_count)
           VALUES ('{"items":[],"media":[]}', 5, 12, 0)`
        )
        .run();

      const row = await db
        .prepare("SELECT * FROM rsi_staging_reports ORDER BY id DESC LIMIT 1")
        .first();
      expect(row!.new_items_count).toBe(5);
      expect(row!.new_media_count).toBe(12);
      expect(row!.emailed_at).toBeNull();
      expect(row!.reviewed_at).toBeNull();
    });
  });
});
