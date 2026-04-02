import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { setupTestDatabase } from "./apply-migrations";

/**
 * Seed contract generator data: generator → career → contract → blueprint pool link
 */
async function seedMissionData(db: D1Database) {
  // Crafting blueprint + reward pool
  await db.batch([
    db.prepare(
      `INSERT INTO crafting_blueprints (uuid, tag, name, type, sub_type, craft_time_seconds)
       VALUES ('bp-uuid-1', 'BP_TEST_RIFLE', 'Test Rifle', 'weapons', 'rifle', 120)`
    ),
    db.prepare(
      `INSERT INTO crafting_blueprints (uuid, tag, name, type, sub_type, craft_time_seconds)
       VALUES ('bp-uuid-2', 'BP_TEST_ARMOUR', 'Test Armour', 'armour', 'combat', 200)`
    ),
  ]);

  const bp1 = await db
    .prepare("SELECT id FROM crafting_blueprints WHERE uuid = 'bp-uuid-1'")
    .first<{ id: number }>();
  const bp2 = await db
    .prepare("SELECT id FROM crafting_blueprints WHERE uuid = 'bp-uuid-2'")
    .first<{ id: number }>();

  // Reward pool with 2 blueprints
  await db
    .prepare(
      `INSERT INTO crafting_blueprint_reward_pools (key, name)
       VALUES ('bp_missionreward_test_pool', 'BP_MISSIONREWARD_TEST_POOL')`
    )
    .run();

  const pool = await db
    .prepare(
      "SELECT id FROM crafting_blueprint_reward_pools WHERE key = 'bp_missionreward_test_pool'"
    )
    .first<{ id: number }>();

  await db.batch([
    db
      .prepare(
        `INSERT INTO crafting_blueprint_reward_pool_items (crafting_blueprint_reward_pool_id, crafting_blueprint_id, weight)
         VALUES (?, ?, 1)`
      )
      .bind(pool!.id, bp1!.id),
    db
      .prepare(
        `INSERT INTO crafting_blueprint_reward_pool_items (crafting_blueprint_reward_pool_id, crafting_blueprint_id, weight)
         VALUES (?, ?, 1)`
      )
      .bind(pool!.id, bp2!.id),
  ]);

  // Contract generator
  await db
    .prepare(
      `INSERT INTO contract_generators (generator_key, display_name, faction_name, guild, mission_type)
       VALUES ('test_recoveritem', 'Test Faction', 'Test Faction', 'mercenary_guild', 'Recovery')`
    )
    .run();

  const gen = await db
    .prepare(
      "SELECT id FROM contract_generators WHERE generator_key = 'test_recoveritem'"
    )
    .first<{ id: number }>();

  // Career (Stanton)
  await db
    .prepare(
      `INSERT INTO contract_generator_careers (contract_generator_id, debug_name, system)
       VALUES (?, 'Test_Recovery_Stanton_Career', 'Stanton')`
    )
    .bind(gen!.id)
    .run();

  const career = await db
    .prepare(
      "SELECT id FROM contract_generator_careers WHERE debug_name = 'Test_Recovery_Stanton_Career'"
    )
    .first<{ id: number }>();

  // Contracts at different difficulties
  await db.batch([
    db
      .prepare(
        `INSERT INTO contract_generator_contracts (career_id, uuid, debug_name, difficulty, template, min_standing, max_standing)
         VALUES (?, 'contract-uuid-easy', 'Test_Recovery_Stanton_Easy', 'Easy', 'courier_goto', 'rank1', 'rank3')`
      )
      .bind(career!.id),
    db
      .prepare(
        `INSERT INTO contract_generator_contracts (career_id, uuid, debug_name, difficulty, template, min_standing, max_standing)
         VALUES (?, 'contract-uuid-hard', 'Test_Recovery_Stanton_Hard', 'Hard', 'courier_goto', 'rank3', 'rank6')`
      )
      .bind(career!.id),
  ]);

  const contractEasy = await db
    .prepare(
      "SELECT id FROM contract_generator_contracts WHERE uuid = 'contract-uuid-easy'"
    )
    .first<{ id: number }>();
  const contractHard = await db
    .prepare(
      "SELECT id FROM contract_generator_contracts WHERE uuid = 'contract-uuid-hard'"
    )
    .first<{ id: number }>();

  // Link contracts to blueprint pool
  await db.batch([
    db
      .prepare(
        `INSERT INTO contract_generator_blueprint_pools (contract_generator_contract_id, crafting_blueprint_reward_pool_id, chance)
         VALUES (?, ?, 1.0)`
      )
      .bind(contractEasy!.id, pool!.id),
    db
      .prepare(
        `INSERT INTO contract_generator_blueprint_pools (contract_generator_contract_id, crafting_blueprint_reward_pool_id, chance)
         VALUES (?, ?, 1.0)`
      )
      .bind(contractHard!.id, pool!.id),
  ]);
}

describe("Mission Detail API", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    await seedMissionData(env.DB);
  });

  describe("GET /api/gamedata/mission/:key", () => {
    it("returns generator with systems and blueprint rewards", async () => {
      const res = await SELF.fetch(
        "http://localhost/api/gamedata/mission/test_recoveritem"
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        generator: {
          key: string;
          display_name: string;
          faction_name: string;
          guild: string;
          mission_type: string;
          description: string | null;
          focus: string | null;
        };
        systems: string[];
        rep_range: { min: string; max: string } | null;
        all_blueprints: { id: number; name: string; type: string }[];
      };

      // Generator metadata
      expect(body.generator.key).toBe("test_recoveritem");
      expect(body.generator.display_name).toBe("Test Faction");
      expect(body.generator.guild).toBe("mercenary_guild");
      expect(body.generator.mission_type).toBe("Recovery");

      // Systems
      expect(body.systems).toContain("Stanton");

      // Difficulty tiers
      expect((body as Record<string, unknown>).tiers).toBeTruthy();
      const tiers = (body as Record<string, unknown>).tiers as { difficulty: string; min_rank: number }[];
      expect(tiers.length).toBeGreaterThanOrEqual(1);
      const easy = tiers.find((t: { difficulty: string }) => t.difficulty === "Easy");
      expect(easy).toBeTruthy();
      expect(easy!.min_rank).toBe(1);

      // All blueprints aggregated
      expect(body.all_blueprints).toHaveLength(2);
      const names = body.all_blueprints.map(
        (b: { name: string }) => b.name
      );
      expect(names).toContain("Test Rifle");
      expect(names).toContain("Test Armour");
    });

    it("returns 404 for non-existent generator", async () => {
      const res = await SELF.fetch(
        "http://localhost/api/gamedata/mission/nonexistent_key"
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("Not found");
    });

    it("does not require authentication", async () => {
      const res = await SELF.fetch(
        "http://localhost/api/gamedata/mission/test_recoveritem"
      );
      expect(res.status).toBe(200);
    });
  });
});
