import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { setupTestDatabase } from "./apply-migrations";

/**
 * Seed contract generator data: generator → career → contract → blueprint pool link
 */
async function seedMissionData(db: D1Database) {
  const gv = await db
    .prepare("SELECT id FROM game_versions WHERE is_default = 1")
    .first<{ id: number }>();
  const gvId = gv!.id;

  // Crafting blueprint + reward pool
  await db.batch([
    db.prepare(
      `INSERT INTO crafting_blueprints (uuid, tag, name, type, sub_type, craft_time_seconds, game_version_id)
       VALUES ('bp-uuid-1', 'BP_TEST_RIFLE', 'Test Rifle', 'weapons', 'rifle', 120, ?)`
    ).bind(gvId),
    db.prepare(
      `INSERT INTO crafting_blueprints (uuid, tag, name, type, sub_type, craft_time_seconds, game_version_id)
       VALUES ('bp-uuid-2', 'BP_TEST_ARMOUR', 'Test Armour', 'armour', 'combat', 200, ?)`
    ).bind(gvId),
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
      `INSERT INTO crafting_blueprint_reward_pools (key, name, game_version_id)
       VALUES ('bp_missionreward_test_pool', 'BP_MISSIONREWARD_TEST_POOL', ?)`
    )
    .bind(gvId)
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
      `INSERT INTO contract_generators (generator_key, display_name, faction_name, guild, mission_type, game_version_id)
       VALUES ('test_recoveritem', 'Test Faction', 'Test Faction', 'mercenary_guild', 'Recovery', ?)`
    )
    .bind(gvId)
    .run();

  const gen = await db
    .prepare(
      "SELECT id FROM contract_generators WHERE generator_key = 'test_recoveritem'"
    )
    .first<{ id: number }>();

  // Career (Stanton)
  await db
    .prepare(
      `INSERT INTO contract_generator_careers (contract_generator_id, debug_name, system, game_version_id)
       VALUES (?, 'Test_Recovery_Stanton_Career', 'Stanton', ?)`
    )
    .bind(gen!.id, gvId)
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
        `INSERT INTO contract_generator_contracts (career_id, uuid, debug_name, difficulty, template, min_standing, max_standing, game_version_id)
         VALUES (?, 'contract-uuid-easy', 'Test_Recovery_Stanton_Easy', 'Easy', 'courier_goto', 'rank1', 'rank3', ?)`
      )
      .bind(career!.id, gvId),
    db
      .prepare(
        `INSERT INTO contract_generator_contracts (career_id, uuid, debug_name, difficulty, template, min_standing, max_standing, game_version_id)
         VALUES (?, 'contract-uuid-hard', 'Test_Recovery_Stanton_Hard', 'Hard', 'courier_goto', 'rank3', 'rank6', ?)`
      )
      .bind(career!.id, gvId),
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
        `INSERT INTO contract_generator_blueprint_pools (contract_generator_contract_id, crafting_blueprint_reward_pool_id, chance, game_version_id)
         VALUES (?, ?, 1.0, ?)`
      )
      .bind(contractEasy!.id, pool!.id, gvId),
    db
      .prepare(
        `INSERT INTO contract_generator_blueprint_pools (contract_generator_contract_id, crafting_blueprint_reward_pool_id, chance, game_version_id)
         VALUES (?, ?, 1.0, ?)`
      )
      .bind(contractHard!.id, pool!.id, gvId),
  ]);
}

describe("Mission Detail API", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    await seedMissionData(env.DB);
  });

  describe("GET /api/gamedata/mission/:key", () => {
    it("returns generator with careers and blueprint pools", async () => {
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
        };
        careers: {
          debug_name: string;
          system: string;
          contracts: {
            debug_name: string;
            difficulty: string;
            template: string;
            blueprint_pools: {
              pool_key: string;
              blueprints: { id: number; name: string; type: string }[];
            }[];
          }[];
        }[];
        all_blueprints: { id: number; name: string; type: string }[];
      };

      // Generator metadata
      expect(body.generator.key).toBe("test_recoveritem");
      expect(body.generator.display_name).toBe("Test Faction");
      expect(body.generator.guild).toBe("mercenary_guild");
      expect(body.generator.mission_type).toBe("Recovery");

      // Careers
      expect(body.careers).toHaveLength(1);
      expect(body.careers[0].system).toBe("Stanton");
      expect(body.careers[0].contracts).toHaveLength(2);

      // Contracts have difficulty tiers
      const difficulties = body.careers[0].contracts.map(
        (c: { difficulty: string }) => c.difficulty
      );
      expect(difficulties).toContain("Easy");
      expect(difficulties).toContain("Hard");

      // Blueprint pools are attached to contracts
      const easyContract = body.careers[0].contracts.find(
        (c: { difficulty: string }) => c.difficulty === "Easy"
      )!;
      expect(easyContract.blueprint_pools).toHaveLength(1);
      expect(easyContract.blueprint_pools[0].blueprints).toHaveLength(2);

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
