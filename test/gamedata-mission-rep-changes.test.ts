import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { setupTestDatabase, TEST_GAME_VERSION_ID } from "./apply-migrations";

/**
 * PART K K13: GET /api/gamedata/missions returns rep_changes map.
 * The mission_rep_changes table (mig 0242) holds structured rep deltas
 * per (mission, scope, event). The endpoint joins them as
 * `rep_changes[mission_id] = [{scope_slug, event, size_code, direction, rep_amount}, ...]`.
 */

async function seedMission(uuid: string, title: string): Promise<number> {
  const row = await env.DB
    .prepare(
      `INSERT INTO missions (uuid, name, title, slug, game_version_id)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(uuid, title, title, uuid, TEST_GAME_VERSION_ID)
    .first<{ id: number }>();
  return row!.id;
}

async function seedRepChange(missionId: number, scope: string, event: string, size: string, direction: string, amount: number | null) {
  await env.DB
    .prepare(
      `INSERT INTO mission_rep_changes
       (mission_id, scope_slug, event, size_code, direction, rep_amount, game_version_id, data_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'test')`,
    )
    .bind(missionId, scope, event, size, direction, amount, TEST_GAME_VERSION_ID)
    .run();
}

describe("GET /api/gamedata/missions — rep_changes", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
  });

  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM mission_rep_changes").run();
    await env.DB.prepare("DELETE FROM missions").run();
  });

  it("returns an empty rep_changes object when the table has no rows", async () => {
    await seedMission("uuid-1", "Plain mission");
    const res = await SELF.fetch("https://example.com/api/gamedata/missions");
    expect(res.status).toBe(200);
    const body = await res.json() as { rep_changes: Record<string, unknown> };
    expect(body.rep_changes).toEqual({});
  });

  it("indexes rep changes by mission_id", async () => {
    const missionId = await seedMission("uuid-2", "Wildlife Control");
    await seedRepChange(missionId, "security", "fail", "M", "negative", -50);
    await seedRepChange(missionId, "affinity", "fail", "S", "negative", -25);

    const res = await SELF.fetch("https://example.com/api/gamedata/missions");
    const body = await res.json() as {
      rep_changes: Record<string, Array<{
        scope_slug: string; event: string; size_code: string; direction: string; rep_amount: number | null;
      }>>
    };
    expect(body.rep_changes[String(missionId)]).toHaveLength(2);
    const scopes = body.rep_changes[String(missionId)].map(r => r.scope_slug).sort();
    expect(scopes).toEqual(["affinity", "security"]);
  });

  it("preserves NULL rep_amount when the tier isn't resolved", async () => {
    const missionId = await seedMission("uuid-3", "Mystery payoff");
    await seedRepChange(missionId, "security", "fail", "XXXL", "negative", null);

    const res = await SELF.fetch("https://example.com/api/gamedata/missions");
    const body = await res.json() as {
      rep_changes: Record<string, Array<{ rep_amount: number | null }>>
    };
    expect(body.rep_changes[String(missionId)][0].rep_amount).toBeNull();
  });

  it("separates rep changes from rep_requirements", async () => {
    const missionId = await seedMission("uuid-4", "Both kinds");
    await seedRepChange(missionId, "security", "abandon", "S", "negative", -10);

    const res = await SELF.fetch("https://example.com/api/gamedata/missions");
    const body = await res.json() as {
      rep_changes: Record<string, unknown>;
      rep_requirements: Record<string, unknown>;
    };
    expect(body.rep_changes).toHaveProperty(String(missionId));
    // rep_requirements is its own (empty here) map, not aliased to rep_changes
    expect(body.rep_requirements).not.toHaveProperty(String(missionId));
  });
});
