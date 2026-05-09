import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { setupTestDatabase } from "./apply-migrations";
import { createTestUser, authHeaders } from "./helpers";

describe("Hangar API — GET /api/hangar", () => {
  let sessionToken: string;
  let userId: string;
  let pledgeId: number;

  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    const user = await createTestUser(env.DB);
    sessionToken = user.sessionToken;
    userId = user.userId;

    // Seed a hangar sync + pledge so user_pledge_items has parent FK targets
    const syncRow = await env.DB.prepare(
      `INSERT INTO user_hangar_syncs (user_id, source, pledge_count, ship_count, item_count)
       VALUES (?, 'extension', 1, 1, 4) RETURNING id`,
    )
      .bind(userId)
      .first<{ id: number }>();

    const pledgeRow = await env.DB.prepare(
      `INSERT INTO user_pledges (user_id, sync_id, rsi_pledge_id, name, value, value_cents, currency)
       VALUES (?, ?, 999001, 'Carrack — Standalone', '$600.00 USD', 60000, 'New Money') RETURNING id`,
    )
      .bind(userId, syncRow!.id)
      .first<{ id: number }>();
    pledgeId = pledgeRow!.id;

    // Seed mixed-kind items including a NULL kind so we can verify "Uncategorised" surfacing
    const items: Array<[string, string | null, string | null]> = [
      ["Carrack", "Ship", "ANVL"],
      ["Lifetime Insurance", "Insurance", null],
      ["Carrack — Best in Show", "Skin", "ANVL"],
      ["Sabine Undersuit Red Festival", null, "CLVI"], // tests null/uncategorised
    ];
    for (let idx = 0; idx < items.length; idx++) {
      const [title, kind, mfr] = items[idx];
      await env.DB.prepare(
        `INSERT INTO user_pledge_items
          (user_id, user_pledge_id, title, kind, manufacturer_code, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(userId, pledgeId, title, kind, mfr, idx)
        .run();
    }
  });

  it("requires authentication", async () => {
    const res = await SELF.fetch("http://localhost/api/hangar");
    expect(res.status).toBe(401);
  });

  it("returns every pledge item plus parent pledge metadata", async () => {
    const res = await SELF.fetch("http://localhost/api/hangar", {
      headers: await authHeaders(sessionToken),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{
        id: number;
        title: string;
        kind: string | null;
        manufacturer_code: string | null;
        pledge_id: number;
        pledge_name: string;
        pledge_value_cents: number | null;
      }>;
      counts: Record<string, number>;
      total: number;
    };

    expect(body.total).toBe(4);
    expect(body.items).toHaveLength(4);

    const carrack = body.items.find((i) => i.title === "Carrack");
    expect(carrack).toBeTruthy();
    expect(carrack!.kind).toBe("Ship");
    expect(carrack!.pledge_name).toBe("Carrack — Standalone");
    expect(carrack!.pledge_value_cents).toBe(60000);

    // NULL kind preserved
    const undersuit = body.items.find((i) => i.title.startsWith("Sabine"));
    expect(undersuit!.kind).toBeNull();
  });

  it("returns kind counts (NULL bucketed under 'uncategorised')", async () => {
    const res = await SELF.fetch("http://localhost/api/hangar", {
      headers: await authHeaders(sessionToken),
    });
    const body = (await res.json()) as { counts: Record<string, number> };
    expect(body.counts.Ship).toBe(1);
    expect(body.counts.Insurance).toBe(1);
    expect(body.counts.Skin).toBe(1);
    expect(body.counts.uncategorised).toBe(1);
  });

  it("scopes to current user — does not leak other users' items", async () => {
    const other = await createTestUser(env.DB);
    const otherSync = await env.DB.prepare(
      `INSERT INTO user_hangar_syncs (user_id, source) VALUES (?, 'extension') RETURNING id`,
    )
      .bind(other.userId)
      .first<{ id: number }>();
    const otherPledge = await env.DB.prepare(
      `INSERT INTO user_pledges (user_id, sync_id, rsi_pledge_id, name)
       VALUES (?, ?, 999002, 'Other User Pledge') RETURNING id`,
    )
      .bind(other.userId, otherSync!.id)
      .first<{ id: number }>();
    await env.DB.prepare(
      `INSERT INTO user_pledge_items (user_id, user_pledge_id, title, kind)
       VALUES (?, ?, 'Other User Item', 'Ship')`,
    )
      .bind(other.userId, otherPledge!.id)
      .run();

    const res = await SELF.fetch("http://localhost/api/hangar", {
      headers: await authHeaders(sessionToken),
    });
    const body = (await res.json()) as {
      items: Array<{ title: string }>;
    };
    expect(body.items.find((i) => i.title === "Other User Item")).toBeUndefined();
  });
});
